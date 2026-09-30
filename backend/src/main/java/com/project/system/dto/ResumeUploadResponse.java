package com.project.system.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.util.List;
import java.util.Map;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ResumeUploadResponse {
    private Long resumeId;
    private Integer atsScore;
    private List<String> missingKeywords;
    private List<String> matchedKeywords;
    private String resumeText;
    private List<String> strengths;
    private List<String> weaknesses;
    private List<String> suggestions;
    private List<String> generatedQuestions;
    private List<Map<String, Object>> highlights;
    private List<Map<String, Object>> pageDimensions;
    private Boolean hasPdf;
}
