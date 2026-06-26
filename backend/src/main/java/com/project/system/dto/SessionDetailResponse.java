package com.project.system.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.time.LocalDateTime;
import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class SessionDetailResponse {
    private Long id;
    private String jobDescription;
    private String status;
    private Integer overallScore;
    private LocalDateTime createdAt;
    private List<QuestionAnswerLogDto> logs;
}
