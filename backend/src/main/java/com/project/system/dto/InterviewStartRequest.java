package com.project.system.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class InterviewStartRequest {
    @NotBlank(message = "Job description is required")
    private String jobDescription;
}
