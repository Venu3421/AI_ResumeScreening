package com.project.system.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class AuthResponse {
    private String token;
    @Builder.Default
    private String type = "Bearer";
    @Builder.Default
    private long expiresIn = 86400; // 24 hours in seconds
    private UserDto user;
}
