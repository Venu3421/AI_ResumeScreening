package com.project.system.service;

import com.fasterxml.jackson.annotation.JsonProperty;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.project.system.dto.*;
import com.project.system.entity.InterviewSession;
import com.project.system.entity.QuestionAnswerLog;
import com.project.system.entity.User;
import com.project.system.exception.BadRequestException;
import com.project.system.exception.ResourceNotFoundException;
import com.project.system.repository.InterviewSessionRepository;
import com.project.system.repository.QuestionAnswerLogRepository;
import com.project.system.repository.UserRepository;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
public class InterviewService {

    private static final int MAX_QUESTIONS = 5;

    private final InterviewSessionRepository sessionRepository;
    private final QuestionAnswerLogRepository logRepository;
    private final UserRepository userRepository;
    private final ObjectMapper objectMapper;
    private final RestTemplate restTemplate;

    @Value("${ai.service.url}")
    private String aiServiceUrl;

    public InterviewService(
            InterviewSessionRepository sessionRepository,
            QuestionAnswerLogRepository logRepository,
            UserRepository userRepository,
            ObjectMapper objectMapper) {
        this.sessionRepository = sessionRepository;
        this.logRepository = logRepository;
        this.userRepository = userRepository;
        this.objectMapper = objectMapper;
        this.restTemplate = new RestTemplate();
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
        String firstQuestion;
        try {
            Map<?, ?> aiResponse = restTemplate.postForObject(aiEndpoint, requestEntity, Map.class);
            if (aiResponse == null || !aiResponse.containsKey("question")) {
                throw new BadRequestException("AI service failed to generate first question.");
            }
            firstQuestion = (String) aiResponse.get("question");
        } catch (org.springframework.web.client.RestClientException e) {
            throw new BadRequestException("Failed to generate first question: " + e.getMessage());
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
                                              Integer bodyLanguage) {
        // 1. Find and Verify Session
        InterviewSession session = sessionRepository.findById(sessionId)
                .orElseThrow(() -> new ResourceNotFoundException("Interview session not found: " + sessionId));

        if (!session.getUser().getEmail().equals(userEmail)) {
            throw new BadRequestException("Unauthorized access to this interview session.");
        }

        if ("COMPLETED".equals(session.getStatus())) {
            throw new BadRequestException("Interview session is already completed.");
        }

        // 2. Verify Audio file
        if (audioFile.isEmpty()) {
            throw new BadRequestException("Submitted audio file is empty.");
        }
        if (audioFile.getSize() < 1024) { // Let's check size instead of raw duration, 1KB minimum
            throw new BadRequestException("Audio file is too short.");
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

        // 4. Send Multipart Request to AI Service
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
        // Forward client-measured recording duration to ai-service for speaking pace calculation
        if (durationSeconds != null) {
            body.add("duration_seconds", String.valueOf(durationSeconds));
        }

        HttpEntity<MultiValueMap<String, Object>> requestEntity = new HttpEntity<>(body, headers);
        AiEvaluationResponse aiResponse;
        try {
            aiResponse = restTemplate.postForObject(aiEndpoint, requestEntity, AiEvaluationResponse.class);
            if (aiResponse == null) {
                throw new BadRequestException("AI service failed to evaluate answer.");
            }
        } catch (org.springframework.web.client.RestClientException e) {
            throw new BadRequestException("AI evaluation failed: " + e.getMessage());
        }

        // 5. Update Current Log
        // Find log corresponding to this question (usually the latest active log)
        QuestionAnswerLog currentLog = logs.stream()
                .filter(l -> l.getQuestionText().equals(questionText) && l.getTranscript() == null)
                .findFirst()
                .orElseThrow(() -> new BadRequestException("Question log not found or already evaluated: " + questionText));

        // Merge frontend-supplied camera presence metrics (Phase 4) into the
        // ai-service response before storing. The ai-service returns these as null;
        // the frontend overwrites them when camera data is available.
        Map<String, Object> metricsToStore = new java.util.LinkedHashMap<>(aiResponse.getEvaluationMetrics());
        if (interviewPresence != null) metricsToStore.put("interviewPresence", interviewPresence);
        if (eyeContact != null) metricsToStore.put("eyeContact", eyeContact);
        if (bodyLanguage != null) metricsToStore.put("bodyLanguage", bodyLanguage);

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
