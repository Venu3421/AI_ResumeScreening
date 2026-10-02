package com.project.system.service;

import com.fasterxml.jackson.annotation.JsonProperty;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.project.system.dto.*;
import com.project.system.entity.InterviewSession;
import com.project.system.entity.QuestionAnswerLog;
import com.project.system.entity.Resume;
import com.project.system.entity.User;
import com.project.system.exception.BadRequestException;
import com.project.system.exception.ResourceNotFoundException;
import com.project.system.repository.InterviewSessionRepository;
import com.project.system.repository.QuestionAnswerLogRepository;
import com.project.system.repository.ResumeRepository;
import com.project.system.repository.UserRepository;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.HttpStatusCodeException;
import org.springframework.web.client.ResourceAccessException;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.time.Duration;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Slf4j
@Service
public class InterviewService {

    private static final int MAX_QUESTIONS = 5;

    private final InterviewSessionRepository sessionRepository;
    private final QuestionAnswerLogRepository logRepository;
    private final UserRepository userRepository;
    private final ResumeRepository resumeRepository;
    private final ObjectMapper objectMapper;
    private final RestTemplate restTemplate;

    @Value("${ai.service.url}")
    private String aiServiceUrl;

    public InterviewService(
            InterviewSessionRepository sessionRepository,
            QuestionAnswerLogRepository logRepository,
            UserRepository userRepository,
            ResumeRepository resumeRepository,
            ObjectMapper objectMapper) {
        this.sessionRepository = sessionRepository;
        this.logRepository = logRepository;
        this.userRepository = userRepository;
        this.resumeRepository = resumeRepository;
        this.objectMapper = objectMapper;
        this.restTemplate = createRestTemplate();
    }

    private static RestTemplate createRestTemplate() {
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout((int) Duration.ofSeconds(30).toMillis());
        factory.setReadTimeout((int) Duration.ofSeconds(120).toMillis());
        return new RestTemplate(factory);
    }

    private <T> T postToAiServiceWithRetry(String endpoint, HttpEntity<?> requestEntity, Class<T> responseType, String actionDescription) {
        int maxAttempts = 8;
        for (int attempt = 1; attempt <= maxAttempts; attempt++) {
            try {
                T response = restTemplate.postForObject(endpoint, requestEntity, responseType);
                if (response != null) {
                    return response;
                }
            } catch (HttpStatusCodeException e) {
                int status = e.getStatusCode().value();
                if ((status == 502 || status == 503 || status == 504) && attempt < maxAttempts) {
                    log.warn("AI service returned HTTP {} during {} on attempt {}/{} (cloud service waking up). Retrying in 6 seconds...",
                            status, actionDescription, attempt, maxAttempts);
                    try {
                        Thread.sleep(6000);
                    } catch (InterruptedException ie) {
                        Thread.currentThread().interrupt();
                        throw new BadRequestException("Request interrupted while waiting for AI service.");
                    }
                    continue;
                }
                if (status == 502 || status == 503 || status == 504) {
                    throw new BadRequestException("The AI microservice is currently waking up on the free cloud tier. Please wait 15 seconds and try again.");
                }
                throw new BadRequestException(actionDescription + " failed: " + e.getMessage());
            } catch (ResourceAccessException e) {
                if (attempt < maxAttempts) {
                    log.warn("AI service connection failed during {} on attempt {}/{} (cloud service waking up): {}. Retrying in 6 seconds...",
                            actionDescription, attempt, maxAttempts, e.getMessage());
                    try {
                        Thread.sleep(6000);
                    } catch (InterruptedException ie) {
                        Thread.currentThread().interrupt();
                        throw new BadRequestException("Request interrupted while waiting for AI service.");
                    }
                    continue;
                }
                throw new BadRequestException("The AI microservice is currently waking up on the free cloud tier. Please wait 15 seconds and try again.");
            } catch (org.springframework.web.client.RestClientException e) {
                throw new BadRequestException(actionDescription + " failed: " + e.getMessage());
            }
        }
        throw new BadRequestException("AI service returned empty response for " + actionDescription + ".");
    }

    // ==================== Backward-Compatibility: Legacy Metrics Translation ====================

    /**
     * ONE-TIME BACKWARD-COMPATIBILITY TRANSLATION (Phase 3).
     *
     * <p>Translates legacy metrics_json rows (containing old keys: technicalAccuracy,
     * communicationClarity, structuralLogic) into the new EvaluationMetricsDto schema.
     * This is NOT a permanent dual-schema pattern — it exists only to support old session
     * data until those rows are no longer relevant, at which point this method can be removed.
     *
     * <p>Translation rules:
     * <ul>
     *   <li>technicalScore = average(technicalAccuracy, structuralLogic) — folds structural logic into technical</li>
     *   <li>communicationScore = communicationClarity — direct mapping</li>
     *   <li>New fields (professionalism, confidence, speakingPace, camera fields) → null</li>
     *   <li>constructiveFeedback → carried forward as-is</li>
     * </ul>
     *
     * <p>Detection: a row is considered "legacy" if it has a "technicalAccuracy" key but no "technicalScore" key.
     *
     * @param metricsJson the raw JSON string from question_answer_logs.metrics_json
     * @return EvaluationMetricsDto populated from either new or legacy schema, or null if unparseable
     */
    @SuppressWarnings("unchecked")
    private EvaluationMetricsDto translateLegacyMetrics(String metricsJson) {
        if (metricsJson == null || metricsJson.isBlank()) {
            return null;
        }

        try {
            Map<String, Object> raw = objectMapper.readValue(metricsJson, Map.class);

            // Detect legacy schema: has old key "technicalAccuracy" but not new key "technicalScore"
            boolean isLegacy = raw.containsKey("technicalAccuracy") && !raw.containsKey("technicalScore");

            if (isLegacy) {
                // Legacy row translation
                Integer technicalAccuracy = toInteger(raw.get("technicalAccuracy"));
                Integer structuralLogic = toInteger(raw.get("structuralLogic"));
                Integer communicationClarity = toInteger(raw.get("communicationClarity"));
                String feedback = raw.get("constructiveFeedback") != null
                        ? raw.get("constructiveFeedback").toString() : "";

                // technicalScore = average of old technicalAccuracy and structuralLogic
                Integer technicalScore = null;
                if (technicalAccuracy != null && structuralLogic != null) {
                    technicalScore = (int) Math.round((technicalAccuracy + structuralLogic) / 2.0);
                } else if (technicalAccuracy != null) {
                    technicalScore = technicalAccuracy;
                } else if (structuralLogic != null) {
                    technicalScore = structuralLogic;
                }

                return EvaluationMetricsDto.builder()
                        .technicalScore(technicalScore)
                        .communicationScore(communicationClarity)
                        .professionalism(null)      // Not available in legacy data
                        .confidence(null)            // Not available in legacy data
                        .constructiveFeedback(feedback)
                        .speakingPace(null)           // Not available in legacy data
                        .interviewPresence(null)      // Phase 4
                        .eyeContact(null)             // Phase 4
                        .bodyLanguage(null)            // Phase 4
                        .facialComposure(null)         // Phase 7
                        .build();
            } else {
                // New schema row — deserialize directly (JsonIgnoreProperties handles unknowns)
                return objectMapper.readValue(metricsJson, EvaluationMetricsDto.class);
            }
        } catch (JsonProcessingException e) {
            return null;
        }
    }

    /**
     * Safely convert a Map value to Integer, handling both Integer and Double types
     * that Jackson may produce when deserializing JSON numbers into a generic Map.
     */
    private Integer toInteger(Object value) {
        if (value instanceof Integer) {
            return (Integer) value;
        } else if (value instanceof Number) {
            return ((Number) value).intValue();
        }
        return null;
    }

    private String normalizeQuestionText(String text) {
        if (text == null) {
            return "";
        }
        return text.replace("\r\n", "\n").replace("\r", "\n").trim();
    }

    // ==================== Session Management ====================

    @Transactional
    public InterviewStartResponse startSession(String jobDescription, String userEmail) {
        User user = userRepository.findByEmail(userEmail)
                .orElseThrow(() -> new ResourceNotFoundException("User not found: " + userEmail));

        // 1. Generate First Question from AI Service
        String aiEndpoint = aiServiceUrl + "/api/v1/ai/generate-question";
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_FORM_URLENCODED);

        MultiValueMap<String, String> map = new LinkedMultiValueMap<>();
        map.add("job_description", jobDescription);

        HttpEntity<MultiValueMap<String, String>> requestEntity = new HttpEntity<>(map, headers);
        Map<?, ?> aiResponse = postToAiServiceWithRetry(aiEndpoint, requestEntity, Map.class, "First question generation");
        if (aiResponse == null || !aiResponse.containsKey("question")) {
            throw new BadRequestException("AI service failed to generate first question.");
        }
        String firstQuestion = (String) aiResponse.get("question");
        if (firstQuestion != null) {
            firstQuestion = normalizeQuestionText(firstQuestion);
        }

        // 2. Save Session
        InterviewSession session = InterviewSession.builder()
                .user(user)
                .jobDescription(jobDescription)
                .status("ACTIVE")
                .overallScore(0)
                .build();

        session = sessionRepository.save(session);

        // 3. Save first QA Log
        QuestionAnswerLog firstLog = QuestionAnswerLog.builder()
                .session(session)
                .questionText(firstQuestion)
                .build();

        logRepository.save(firstLog);

        return InterviewStartResponse.builder()
                .sessionId(session.getId())
                .status(session.getStatus())
                .firstQuestion(firstQuestion)
                .build();
    }

    @Transactional
    public SubmitAnswerResponse submitAnswer(Long sessionId, String questionText,
                                              MultipartFile audioFile, String userEmail,
                                              Integer durationSeconds,
                                              Integer interviewPresence,
                                              Integer eyeContact,
                                              Integer bodyLanguage,
                                              Integer facialComposure) {
        return submitAnswer(sessionId, questionText, audioFile, userEmail,
                durationSeconds, interviewPresence, eyeContact, bodyLanguage, facialComposure,
                null, null);
    }

    @Transactional
    public SubmitAnswerResponse submitAnswer(Long sessionId, String questionText,
                                              MultipartFile audioFile, String userEmail,
                                              Integer durationSeconds,
                                              Integer interviewPresence,
                                              Integer eyeContact,
                                              Integer bodyLanguage,
                                              Integer facialComposure,
                                              String codeAnswer,
                                              String codeLanguage) {
        // 1. Find and Verify Session
        InterviewSession session = sessionRepository.findById(sessionId)
                .orElseThrow(() -> new ResourceNotFoundException("Interview session not found: " + sessionId));

        if (!session.getUser().getEmail().equals(userEmail)) {
            throw new BadRequestException("Unauthorized access to this interview session.");
        }

        if ("COMPLETED".equals(session.getStatus())) {
            throw new BadRequestException("Interview session is already completed.");
        }

        if (session.getCreatedAt() != null && session.getCreatedAt().plusDays(1).isBefore(LocalDateTime.now())) {
            throw new BadRequestException("Interview session has expired. Resuming is only permitted within 24 hours of creation.");
        }

        // 2. Determine answer mode: code or audio
        boolean isCodeAnswer = codeAnswer != null && !codeAnswer.isBlank();

        if (!isCodeAnswer) {
            // Audio mode validation
            if (audioFile == null || audioFile.isEmpty()) {
                throw new BadRequestException("Either an audio file or a code answer is required.");
            }
            if (audioFile.getSize() < 1024) {
                throw new BadRequestException("Audio file is too short.");
            }
        }

        // 3. Construct Question History
        List<QuestionAnswerLog> logs = logRepository.findBySessionIdOrderByCreatedAtAsc(sessionId);
        List<String> questionHistoryList = logs.stream()
                .filter(l -> l.getTranscript() != null) // only evaluated questions
                .map(QuestionAnswerLog::getQuestionText)
                .collect(Collectors.toList());

        String questionHistoryJson;
        try {
            questionHistoryJson = objectMapper.writeValueAsString(questionHistoryList);
        } catch (JsonProcessingException e) {
            questionHistoryJson = "[]";
        }

        // 4. Send Request to AI Service (branched by answer mode)
        AiEvaluationResponse aiResponse;

        if (isCodeAnswer) {
            // ---- Code Answer Path: JSON body to /evaluate-code-answer ----
            String aiEndpoint = aiServiceUrl + "/api/v1/ai/evaluate-code-answer";
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);

            Map<String, String> requestBody = new java.util.LinkedHashMap<>();
            requestBody.put("code_answer", codeAnswer);
            requestBody.put("code_language", codeLanguage != null ? codeLanguage : "javascript");
            requestBody.put("question_text", questionText);
            requestBody.put("job_description", session.getJobDescription());
            requestBody.put("question_history", questionHistoryJson);

            HttpEntity<Map<String, String>> requestEntity = new HttpEntity<>(requestBody, headers);
            aiResponse = postToAiServiceWithRetry(aiEndpoint, requestEntity, AiEvaluationResponse.class, "AI code evaluation");
        } else {
            // ---- Audio Answer Path: Multipart to /evaluate-answer (existing flow) ----
            String aiEndpoint = aiServiceUrl + "/api/v1/ai/evaluate-answer";
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.MULTIPART_FORM_DATA);

            ByteArrayResource fileResource;
            try {
                fileResource = new ByteArrayResource(audioFile.getBytes()) {
                    @Override
                    public String getFilename() {
                        return audioFile.getOriginalFilename() != null ? audioFile.getOriginalFilename() : "answer.webm";
                    }
                };
            } catch (IOException e) {
                throw new BadRequestException("Failed to read audio file: " + e.getMessage());
            }

            MultiValueMap<String, Object> body = new LinkedMultiValueMap<>();
            body.add("file", fileResource);
            body.add("question_text", questionText);
            body.add("job_description", session.getJobDescription());
            body.add("question_history", questionHistoryJson);
            if (durationSeconds != null) {
                body.add("duration_seconds", String.valueOf(durationSeconds));
            }

            HttpEntity<MultiValueMap<String, Object>> requestEntity = new HttpEntity<>(body, headers);
            aiResponse = postToAiServiceWithRetry(aiEndpoint, requestEntity, AiEvaluationResponse.class, "AI audio answer evaluation");
        }

        // 5. Update Current Log
        // Find log corresponding to this question (robustly matching normalized text with CRLF/whitespace handling,
        // falling back to the currently pending unanswered log in this session).
        String normalizedSubmitted = normalizeQuestionText(questionText);
        QuestionAnswerLog currentLog = logs.stream()
                .filter(l -> l.getTranscript() == null && normalizeQuestionText(l.getQuestionText()).equals(normalizedSubmitted))
                .findFirst()
                .or(() -> logs.stream()
                        .filter(l -> l.getTranscript() == null)
                        .findFirst())
                .orElseThrow(() -> new BadRequestException("Question log not found or already evaluated: " + questionText));

        // Merge frontend-supplied camera presence metrics (Phase 4) into the
        // ai-service response before storing. The ai-service returns these as null;
        // the frontend overwrites them when camera data is available.
        // For code answers, camera metrics stay null (no camera data collected in code mode).
        Map<String, Object> metricsToStore = new java.util.LinkedHashMap<>(aiResponse.getEvaluationMetrics());
        if (!isCodeAnswer) {
            if (interviewPresence != null) metricsToStore.put("interviewPresence", interviewPresence);
            if (eyeContact != null) metricsToStore.put("eyeContact", eyeContact);
            if (bodyLanguage != null) metricsToStore.put("bodyLanguage", bodyLanguage);
            if (facialComposure != null) metricsToStore.put("facialComposure", facialComposure);
        }

        String metricsJsonStr;
        try {
            metricsJsonStr = objectMapper.writeValueAsString(metricsToStore);
        } catch (JsonProcessingException e) {
            throw new BadRequestException("Failed to serialize evaluation metrics: " + e.getMessage());
        }

        currentLog.setTranscript(aiResponse.getTranscript());
        currentLog.setMetricsJson(metricsJsonStr);
        logRepository.save(currentLog);

        // 6. Handle Completion / Progression
        long currentCount = logs.size();
        String nextQuestion = null;

        if (currentCount >= MAX_QUESTIONS) {
            // Complete Session
            session.setStatus("COMPLETED");

            // Calculate Overall Score using the new metrics schema
            List<QuestionAnswerLog> finalLogs = logRepository.findBySessionIdOrderByCreatedAtAsc(sessionId);
            double totalScoreSum = 0;
            int logsWithScore = 0;

            for (QuestionAnswerLog log : finalLogs) {
                if (log.getMetricsJson() != null) {
                    // Use translateLegacyMetrics to handle both old and new row formats
                    EvaluationMetricsDto metrics = translateLegacyMetrics(log.getMetricsJson());
                    if (metrics != null) {
                        // Average of technicalScore and communicationScore (the two primary Gemini scores)
                        Integer tech = metrics.getTechnicalScore();
                        Integer comm = metrics.getCommunicationScore();
                        int scoreCount = 0;
                        double scoreSum = 0;
                        if (tech != null) { scoreSum += tech; scoreCount++; }
                        if (comm != null) { scoreSum += comm; scoreCount++; }
                        if (scoreCount > 0) {
                            totalScoreSum += scoreSum / scoreCount;
                            logsWithScore++;
                        }
                    }
                }
            }

            if (logsWithScore > 0) {
                session.setOverallScore((int) Math.round(totalScoreSum / logsWithScore));
            } else {
                session.setOverallScore(0);
            }
            sessionRepository.save(session);
        } else {
            // Save Next Question for session progression
            nextQuestion = aiResponse.getNextQuestion();
            if (nextQuestion != null) {
                nextQuestion = normalizeQuestionText(nextQuestion);
            }
            QuestionAnswerLog nextLog = QuestionAnswerLog.builder()
                    .session(session)
                    .questionText(nextQuestion)
                    .build();
            logRepository.save(nextLog);
        }

        // Map merged metrics (ai-service + camera data) to EvaluationMetricsDto for the response
        EvaluationMetricsDto metricsDto = EvaluationMetricsDto.builder()
                .technicalScore(toInteger(metricsToStore.get("technicalScore")))
                .communicationScore(toInteger(metricsToStore.get("communicationScore")))
                .professionalism(toInteger(metricsToStore.get("professionalism")))
                .confidence(toInteger(metricsToStore.get("confidence")))
                .constructiveFeedback(metricsToStore.get("constructiveFeedback") != null
                        ? metricsToStore.get("constructiveFeedback").toString() : "")
                .speakingPace(toInteger(metricsToStore.get("speakingPace")))
                .interviewPresence(toInteger(metricsToStore.get("interviewPresence")))
                .eyeContact(toInteger(metricsToStore.get("eyeContact")))
                .bodyLanguage(toInteger(metricsToStore.get("bodyLanguage")))
                .facialComposure(toInteger(metricsToStore.get("facialComposure")))
                .build();

        return SubmitAnswerResponse.builder()
                .logId(currentLog.getId())
                .transcript(aiResponse.getTranscript())
                .evaluationMetrics(metricsDto)
                .nextQuestion(nextQuestion)
                .build();
    }

    @Transactional(readOnly = true)
    public List<SessionHistoryResponse> getSessionHistory(String userEmail) {
        User user = userRepository.findByEmail(userEmail)
                .orElseThrow(() -> new ResourceNotFoundException("User not found: " + userEmail));

        List<InterviewSession> sessions = sessionRepository.findByUserIdOrderByCreatedAtDesc(user.getId());
        return sessions.stream()
                .map(s -> SessionHistoryResponse.builder()
                        .id(s.getId())
                        .jobDescription(s.getJobDescription())
                        .status(s.getStatus())
                        .overallScore(s.getOverallScore())
                        .createdAt(s.getCreatedAt())
                        .build())
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public SessionDetailResponse getSessionDetail(Long sessionId, String userEmail) {
        InterviewSession session = sessionRepository.findById(sessionId)
                .orElseThrow(() -> new ResourceNotFoundException("Interview session not found: " + sessionId));

        if (!session.getUser().getEmail().equals(userEmail)) {
            throw new BadRequestException("Unauthorized access to this interview session.");
        }

        List<QuestionAnswerLog> logs = logRepository.findBySessionIdOrderByCreatedAtAsc(sessionId);
        List<QuestionAnswerLogDto> logDtos = logs.stream()
                .map(l -> {
                    // Use translateLegacyMetrics to handle both old and new metrics_json formats
                    EvaluationMetricsDto metricsDto = translateLegacyMetrics(l.getMetricsJson());
                    return QuestionAnswerLogDto.builder()
                            .id(l.getId())
                            .questionText(l.getQuestionText())
                            .transcript(l.getTranscript())
                            .evaluationMetrics(metricsDto)
                            .createdAt(l.getCreatedAt())
                            .build();
                })
                .collect(Collectors.toList());

        return SessionDetailResponse.builder()
                .id(session.getId())
                .jobDescription(session.getJobDescription())
                .status(session.getStatus())
                .overallScore(session.getOverallScore())
                .createdAt(session.getCreatedAt())
                .logs(logDtos)
                .build();
    }

    // ==================== Dashboard Stats Aggregation ====================

    @Transactional(readOnly = true)
    public DashboardStatsResponse getDashboardStats(String userEmail) {
        User user = userRepository.findByEmail(userEmail)
                .orElseThrow(() -> new ResourceNotFoundException("User not found: " + userEmail));
        Long userId = user.getId();

        // 1. Latest ATS Score — from user's most recently updated Resume, or null if none
        Integer latestAtsScore = resumeRepository.findTopByUserIdOrderByUpdatedAtDesc(userId)
                .or(() -> resumeRepository.findByUserId(userId))
                .map(Resume::getAtsScore)
                .orElse(null);

        // 2. Fetch all COMPLETED sessions chronologically
        List<InterviewSession> completedSessions = sessionRepository
                .findByUserIdAndStatusOrderByCreatedAtAsc(userId, "COMPLETED");

        if (completedSessions.isEmpty()) {
            return DashboardStatsResponse.builder()
                    .latestAtsScore(latestAtsScore)
                    .avgTechnicalScore(null)
                    .avgCommunicationScore(null)
                    .avgConfidence(null)
                    .avgSpeakingPace(null)
                    .trend(new ArrayList<>())
                    .build();
        }

        // 3. Parse all evaluated QA logs across completed sessions
        List<EvaluationMetricsDto> allMetrics = new ArrayList<>();
        for (InterviewSession session : completedSessions) {
            List<QuestionAnswerLog> logs = logRepository.findBySessionIdOrderByCreatedAtAsc(session.getId());
            for (QuestionAnswerLog log : logs) {
                if (log.getMetricsJson() != null) {
                    EvaluationMetricsDto metrics = translateLegacyMetrics(log.getMetricsJson());
                    if (metrics != null) {
                        allMetrics.add(metrics);
                    }
                }
            }
        }

        // 4. Compute per-dimension null-safe averages (skipping nulls)
        Integer avgTechnicalScore = nullSafeAverage(allMetrics.stream()
                .map(EvaluationMetricsDto::getTechnicalScore)
                .collect(Collectors.toList()));

        Integer avgCommunicationScore = nullSafeAverage(allMetrics.stream()
                .map(EvaluationMetricsDto::getCommunicationScore)
                .collect(Collectors.toList()));

        Integer avgConfidence = nullSafeAverage(allMetrics.stream()
                .map(EvaluationMetricsDto::getConfidence)
                .collect(Collectors.toList()));

        Integer avgSpeakingPace = nullSafeAverage(allMetrics.stream()
                .map(EvaluationMetricsDto::getSpeakingPace)
                .collect(Collectors.toList()));

        // 5. Build chronological trend per completed session
        List<DashboardStatsResponse.TrendPoint> trend = completedSessions.stream()
                .filter(s -> s.getOverallScore() != null)
                .map(s -> DashboardStatsResponse.TrendPoint.builder()
                        .date(s.getCreatedAt() != null ? s.getCreatedAt().toLocalDate() : LocalDate.now())
                        .overallScore(s.getOverallScore())
                        .build())
                .collect(Collectors.toList());

        return DashboardStatsResponse.builder()
                .latestAtsScore(latestAtsScore)
                .avgTechnicalScore(avgTechnicalScore)
                .avgCommunicationScore(avgCommunicationScore)
                .avgConfidence(avgConfidence)
                .avgSpeakingPace(avgSpeakingPace)
                .trend(trend)
                .build();
    }

    /**
     * Compute the average of a list of nullable Integers, skipping nulls.
     * Returns null if no non-null values exist.
     */
    private Integer nullSafeAverage(List<Integer> values) {
        double sum = 0;
        int count = 0;
        for (Integer v : values) {
            if (v != null) {
                sum += v;
                count++;
            }
        }
        return count > 0 ? (int) Math.round(sum / count) : null;
    }

    // Helper Response mapping classes
    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    private static class AiEvaluationResponse {
        private String transcript;

        @JsonProperty("evaluation_metrics")
        private Map<String, Object> evaluationMetrics;

        @JsonProperty("next_question")
        private String nextQuestion;
    }
}
