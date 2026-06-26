package com.project.system.service;

import com.fasterxml.jackson.annotation.JsonProperty;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.project.system.dto.ResumeUploadResponse;
import com.project.system.entity.Resume;
import com.project.system.entity.User;
import com.project.system.exception.BadRequestException;
import com.project.system.exception.ResourceNotFoundException;
import com.project.system.repository.ResumeRepository;
import com.project.system.repository.UserRepository;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.apache.tika.Tika;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.multipart.MultipartFile;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

@Service
public class ResumeService {

    private final ResumeRepository resumeRepository;
    private final UserRepository userRepository;
    private final ObjectMapper objectMapper;
    private final RestTemplate restTemplate;
    private final Tika tika;

    @Value("${ai.service.url}")
    private String aiServiceUrl;

    public ResumeService(ResumeRepository resumeRepository, UserRepository userRepository, ObjectMapper objectMapper) {
        this.resumeRepository = resumeRepository;
        this.userRepository = userRepository;
        this.objectMapper = objectMapper;
        this.restTemplate = new RestTemplate();
        this.tika = new Tika();
    }

    @Transactional
    public ResumeUploadResponse uploadAndAnalyze(MultipartFile file, String jobDescription, String userEmail) {
        // 1. Validation
        if (file.isEmpty()) {
            throw new BadRequestException("Uploaded file is empty.");
        }
        String filename = file.getOriginalFilename();
        if (!"application/pdf".equals(file.getContentType()) && (filename == null || !filename.endsWith(".pdf"))) {
            throw new BadRequestException("Only PDF resumes are supported.");
        }
        if (file.getSize() > 5 * 1024 * 1024) {
            throw new BadRequestException("File size exceeds the 5MB limit.");
        }

        User user = userRepository.findByEmail(userEmail)
                .orElseThrow(() -> new ResourceNotFoundException("User not found: " + userEmail));

        // 2. Text Extraction using Apache Tika
        String resumeText;
        try {
            resumeText = tika.parseToString(file.getInputStream());
            if (resumeText == null || resumeText.trim().isEmpty()) {
                throw new BadRequestException("Could not extract readable text from the PDF.");
            }
        } catch (org.apache.tika.exception.TikaException | java.io.IOException e) {
            throw new BadRequestException("Failed to extract text from PDF: " + e.getMessage());
        }

        // 3. Call AI Service
        String aiEndpoint = aiServiceUrl + "/api/v1/ai/analyze-resume";
        AiResumeAnalysisRequest aiRequest = new AiResumeAnalysisRequest(resumeText, jobDescription);

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        HttpEntity<AiResumeAnalysisRequest> requestEntity = new HttpEntity<>(aiRequest, headers);

        AiResumeAnalysisResponse aiResponse;
        try {
            aiResponse = restTemplate.postForObject(aiEndpoint, requestEntity, AiResumeAnalysisResponse.class);
            if (aiResponse == null) {
                throw new BadRequestException("AI service returned empty response.");
            }
        } catch (org.springframework.web.client.RestClientException e) {
            throw new BadRequestException("AI analysis failed: " + e.getMessage());
        }

        // 4. Construct Feedback JSON
        Map<String, Object> feedbackMap = new HashMap<>();
        feedbackMap.put("missingKeywords", aiResponse.getMissingKeywords());
        feedbackMap.put("strengths", aiResponse.getStrengths());
        feedbackMap.put("weaknesses", aiResponse.getWeaknesses());
        feedbackMap.put("suggestions", aiResponse.getSuggestions());
        feedbackMap.put("generatedQuestions", aiResponse.getGeneratedQuestions());

        String feedbackJson;
        try {
            feedbackJson = objectMapper.writeValueAsString(feedbackMap);
        } catch (JsonProcessingException e) {
            throw new BadRequestException("Failed to serialize feedback JSON: " + e.getMessage());
        }

        // 5. Save/Update Resume entity
        Resume resume = resumeRepository.findByUserId(user.getId())
                .orElse(Resume.builder().user(user).build());

        resume.setRawText(resumeText);
        resume.setAtsScore(aiResponse.getAtsScore());
        resume.setFeedbackJson(feedbackJson);
        resume.setUpdatedAt(LocalDateTime.now());

        resumeRepository.save(resume);

        // 6. Map to DTO
        return ResumeUploadResponse.builder()
                .resumeId(resume.getId())
                .atsScore(resume.getAtsScore())
                .missingKeywords(aiResponse.getMissingKeywords())
                .strengths(aiResponse.getStrengths())
                .weaknesses(aiResponse.getWeaknesses())
                .suggestions(aiResponse.getSuggestions())
                .generatedQuestions(aiResponse.getGeneratedQuestions())
                .build();
    }

    @Transactional(readOnly = true)
    @SuppressWarnings("unchecked")
    public ResumeUploadResponse getResume(String userEmail) {
        User user = userRepository.findByEmail(userEmail)
                .orElseThrow(() -> new ResourceNotFoundException("User not found: " + userEmail));

        Optional<Resume> resumeOpt = resumeRepository.findByUserId(user.getId());
        if (resumeOpt.isEmpty()) {
            return null;
        }

        Resume resume = resumeOpt.get();
        Map<String, Object> feedbackMap;
        try {
            feedbackMap = objectMapper.readValue(resume.getFeedbackJson(), Map.class);
        } catch (com.fasterxml.jackson.core.JsonProcessingException e) {
            feedbackMap = new HashMap<>();
        }

        return ResumeUploadResponse.builder()
                .resumeId(resume.getId())
                .atsScore(resume.getAtsScore())
                .missingKeywords((List<String>) feedbackMap.get("missingKeywords"))
                .strengths((List<String>) feedbackMap.get("strengths"))
                .weaknesses((List<String>) feedbackMap.get("weaknesses"))
                .suggestions((List<String>) feedbackMap.get("suggestions"))
                .generatedQuestions((List<String>) feedbackMap.get("generatedQuestions"))
                .build();
    }

    // Helper classes for AI service communication
    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    private static class AiResumeAnalysisRequest {
        @JsonProperty("resume_text")
        private String resumeText;

        @JsonProperty("job_description")
        private String jobDescription;
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    private static class AiResumeAnalysisResponse {
        @JsonProperty("ats_score")
        private int atsScore;

        @JsonProperty("missing_keywords")
        private List<String> missingKeywords;

        private List<String> strengths;
        private List<String> weaknesses;
        private List<String> suggestions;

        @JsonProperty("generated_questions")
        private List<String> generatedQuestions;
    }
}
