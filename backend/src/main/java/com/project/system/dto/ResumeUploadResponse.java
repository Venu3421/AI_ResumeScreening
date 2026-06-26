package com.project.system.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ResumeUploadResponse {
    private Long resumeId;
    private Integer atsScore;
    private List<String> missingKeywords;
    private List<String> strengths;
    private List<String> weaknesses;
    private List<String> suggestions;
    private List<String> generatedQuestions;
}
