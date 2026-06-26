package com.project.system.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class EvaluationMetricsDto {
    private Integer technicalAccuracy;
    private Integer communicationClarity;
    private Integer structuralLogic;
    private String constructiveFeedback;
}
