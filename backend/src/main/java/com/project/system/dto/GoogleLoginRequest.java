package com.project.system.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class GoogleLoginRequest {
    @NotBlank(message = "Credential token is required")
    private String credential;
}
