package com.project.system.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class InterviewStartResponse {
    private Long sessionId;
    private String status;
    private String firstQuestion;
}
