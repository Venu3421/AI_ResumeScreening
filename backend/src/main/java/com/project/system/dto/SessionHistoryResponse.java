package com.project.system.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.time.LocalDateTime;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class SessionHistoryResponse {
    private Long id;
    private String jobDescription;
    private String status;
    private Integer overallScore;
    private LocalDateTime createdAt;
}
