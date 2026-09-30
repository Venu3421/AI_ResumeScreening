package com.project.system.dto;

import com.fasterxml.jackson.annotation.JsonFormat;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDate;
import java.util.List;

/**
 * Response DTO for the dashboard stats aggregate endpoint (GET /api/v1/interview/stats).
 * All metrics use wrapper types (Integer) so they evaluate to null when no data exists,
 * allowing honest empty-state rendering without fake defaults.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class DashboardStatsResponse {

    /** Latest ATS score from user's most recent Resume, null if none. */
    private Integer latestAtsScore;

    /** Avg across all completed sessions' answers, null if none. */
    private Integer avgTechnicalScore;

    private Integer avgCommunicationScore;

    private Integer avgConfidence;

    /** Averaged only over answers where it's non-null. */
    private Integer avgSpeakingPace;

    /** Chronological trend points per completed session ({ LocalDate date, Integer overallScore }). */
    private List<TrendPoint> trend;

    // Backward-compatibility aliases
    public Integer getAtsScore() {
        return latestAtsScore;
    }

    public Integer getTechnicalScore() {
        return avgTechnicalScore;
    }

    public SkillBreakdown getSkillBreakdown() {
        return SkillBreakdown.builder()
                .technicalScore(avgTechnicalScore)
                .communicationScore(avgCommunicationScore)
                .confidence(avgConfidence)
                .speakingPace(avgSpeakingPace)
                .build();
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class TrendPoint {
        @JsonFormat(pattern = "yyyy-MM-dd")
        private LocalDate date;
        private Integer overallScore;
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class SkillBreakdown {
        private Integer technicalScore;
        private Integer communicationScore;
        private Integer confidence;
        private Integer speakingPace;
    }
}
