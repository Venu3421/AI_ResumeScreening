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
        if (!"application/pdf".equals(file.getContentType()) && (filename == null || !filename.toLowerCase().endsWith(".pdf"))
            && !filename.toLowerCase().endsWith(".docx") && !filename.toLowerCase().endsWith(".doc") && !filename.toLowerCase().endsWith(".txt")) {
            throw new BadRequestException("Only PDF, DOC, DOCX, and TXT resumes are supported.");
        }
        if (file.getSize() > 5 * 1024 * 1024) {
            throw new BadRequestException("File size exceeds the 5MB limit.");
        }

        User user = userRepository.findByEmail(userEmail)
                .orElseThrow(() -> new ResourceNotFoundException("User not found: " + userEmail));

        // 2. Text Extraction (Tika) or PDF forwarding
        String resumeText = null;
        boolean isPdf = "application/pdf".equals(file.getContentType()) || (filename != null && filename.toLowerCase().endsWith(".pdf"));

        // Capture raw PDF bytes for persistence
        byte[] pdfBytes = null;
        if (isPdf) {
            try {
                pdfBytes = file.getBytes();
            } catch (java.io.IOException e) {
                throw new BadRequestException("Failed to read uploaded PDF file.");
            }
        }

        if (!isPdf) {
            try {
                resumeText = tika.parseToString(file.getInputStream());
                if (resumeText == null || resumeText.trim().isEmpty()) {
                    throw new BadRequestException("Could not extract readable text from the file.");
                }
            } catch (org.apache.tika.exception.TikaException | java.io.IOException e) {
                throw new BadRequestException("Failed to extract text from file: " + e.getMessage());
            }
        }

        // 3. Call AI Service
        String aiEndpoint = aiServiceUrl + "/api/v1/ai/analyze-resume";
        
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.MULTIPART_FORM_DATA);

        org.springframework.util.MultiValueMap<String, Object> body = new org.springframework.util.LinkedMultiValueMap<>();
        body.add("job_description", jobDescription);

        if (isPdf) {
            body.add("resume_file", file.getResource());
        } else {
            body.add("resume_text", resumeText);
        }

        HttpEntity<org.springframework.util.MultiValueMap<String, Object>> requestEntity = new HttpEntity<>(body, headers);

        AiResumeAnalysisResponse aiResponse;
        try {
            aiResponse = restTemplate.postForObject(aiEndpoint, requestEntity, AiResumeAnalysisResponse.class);
            if (aiResponse == null) {
                throw new BadRequestException("AI service returned empty response.");
            }
        } catch (org.springframework.web.client.RestClientException e) {
            throw new BadRequestException("AI analysis failed: " + e.getMessage());
        }

        // 4. Construct Feedback JSON (includes highlights for persistence)
        Map<String, Object> feedbackMap = new HashMap<>();
        feedbackMap.put("missingKeywords", aiResponse.getMissingKeywords());
        feedbackMap.put("matchedKeywords", aiResponse.getMatchedKeywords());
        feedbackMap.put("strengths", aiResponse.getStrengths());
        feedbackMap.put("weaknesses", aiResponse.getWeaknesses());
        feedbackMap.put("suggestions", aiResponse.getSuggestions());
        feedbackMap.put("generatedQuestions", aiResponse.getGeneratedQuestions());
        feedbackMap.put("highlights", aiResponse.getHighlights());
        feedbackMap.put("pageDimensions", aiResponse.getPageDimensions());

        String feedbackJson;
        try {
            feedbackJson = objectMapper.writeValueAsString(feedbackMap);
        } catch (JsonProcessingException e) {
            throw new BadRequestException("Failed to serialize feedback JSON: " + e.getMessage());
        }

        // 5. Save/Update Resume entity
        Resume resume = resumeRepository.findByUserId(user.getId())
                .orElse(Resume.builder().user(user).build());

        if (aiResponse.getResumeText() != null && !aiResponse.getResumeText().isBlank()) {
            resume.setRawText(aiResponse.getResumeText());
        } else if (resumeText != null) {
            resume.setRawText(resumeText);
        } else {
            resume.setRawText("PDF Extracted remotely by AI service.");
        }
        resume.setAtsScore(aiResponse.getAtsScore());
        resume.setFeedbackJson(feedbackJson);
        resume.setUpdatedAt(LocalDateTime.now());

        // Persist original PDF bytes
        if (pdfBytes != null && pdfBytes.length > 0) {
            resume.setPdfData(pdfBytes);
        }

        resumeRepository.save(resume);

        // 6. Map to DTO
        return ResumeUploadResponse.builder()
                .resumeId(resume.getId())
                .atsScore(resume.getAtsScore())
                .missingKeywords(aiResponse.getMissingKeywords())
                .matchedKeywords(aiResponse.getMatchedKeywords())
                .resumeText(resume.getRawText())
                .strengths(aiResponse.getStrengths())
                .weaknesses(aiResponse.getWeaknesses())
                .suggestions(aiResponse.getSuggestions())
                .generatedQuestions(aiResponse.getGeneratedQuestions())
                .highlights(aiResponse.getHighlights())
                .pageDimensions(aiResponse.getPageDimensions())
                .hasPdf(pdfBytes != null && pdfBytes.length > 0)
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
                .matchedKeywords((List<String>) feedbackMap.get("matchedKeywords"))
                .resumeText(resume.getRawText())
                .strengths((List<String>) feedbackMap.get("strengths"))
                .weaknesses((List<String>) feedbackMap.get("weaknesses"))
                .suggestions((List<String>) feedbackMap.get("suggestions"))
                .generatedQuestions((List<String>) feedbackMap.get("generatedQuestions"))
                .highlights((List<Map<String, Object>>) feedbackMap.get("highlights"))
                .pageDimensions((List<Map<String, Object>>) feedbackMap.get("pageDimensions"))
                .hasPdf(resume.getPdfData() != null && resume.getPdfData().length > 0)
                .build();
    }

    /**
     * Retrieve the stored PDF bytes for the authenticated user's resume.
     * Returns null if no resume or no PDF is stored.
     */
    @Transactional(readOnly = true)
    public byte[] getResumeFile(String userEmail) {
        User user = userRepository.findByEmail(userEmail)
                .orElseThrow(() -> new ResourceNotFoundException("User not found: " + userEmail));

        Optional<Resume> resumeOpt = resumeRepository.findByUserId(user.getId());
        if (resumeOpt.isEmpty()) {
            return null;
        }

        return resumeOpt.get().getPdfData();
    }

    // Helper classes for AI service communication

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    private static class AiResumeAnalysisResponse {
        @JsonProperty("ats_score")
        private int atsScore;

        @JsonProperty("missing_keywords")
        private List<String> missingKeywords;

        @JsonProperty("matched_keywords")
        private List<String> matchedKeywords;

        @JsonProperty("resume_text")
        private String resumeText;

        private List<String> strengths;
        private List<String> weaknesses;
        private List<String> suggestions;

        @JsonProperty("generated_questions")
        private List<String> generatedQuestions;

        @JsonProperty("highlights")
        private List<Map<String, Object>> highlights;

        @JsonProperty("page_dimensions")
        private List<Map<String, Object>> pageDimensions;
    }
}
