package com.project.system.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class SubmitAnswerResponse {
    private Long logId;
    private String transcript;
    private EvaluationMetricsDto evaluationMetrics;
    private String nextQuestion;
}
