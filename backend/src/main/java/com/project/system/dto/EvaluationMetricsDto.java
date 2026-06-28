package com.project.system.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Extended evaluation metrics DTO (Phase 3).
 *
 * <p>Gemini-derived: technicalScore, communicationScore, professionalism, confidence, constructiveFeedback
 * <p>Computed in ai-service: speakingPace
 * <p>Phase 4 placeholders (MediaPipe camera): interviewPresence, eyeContact, bodyLanguage
 *
 * <p>All Integer fields use wrapper types (not primitives) so they can be null
 * for backward compatibility with old rows and for Phase 4 camera fields.
 *
 * <p>{@code @JsonIgnoreProperties(ignoreUnknown = true)} ensures old metrics_json rows
 * containing legacy keys (technicalAccuracy, communicationClarity, structuralLogic)
 * don't cause deserialization failures. Legacy key translation is handled separately
 * by {@code InterviewService.translateLegacyMetrics()}.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@JsonIgnoreProperties(ignoreUnknown = true)
public class EvaluationMetricsDto {
    // Gemini-derived scores
    private Integer technicalScore;
    private Integer communicationScore;
    private Integer professionalism;
    private Integer confidence;
    private String constructiveFeedback;

    // Computed in ai-service from transcript word count / audio duration
    private Integer speakingPace;

    // Phase 4 placeholders — populated from client-side MediaPipe camera data
    private Integer interviewPresence;
    private Integer eyeContact;
    private Integer bodyLanguage;
}
