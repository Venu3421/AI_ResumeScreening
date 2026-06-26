package com.project.system.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.project.system.config.JwtTokenProvider;
import com.project.system.dto.*;
import com.project.system.service.AuthService;
import com.project.system.service.CustomUserDetailsService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.web.servlet.MockMvc;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(AuthController.class)
public class AuthControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private AuthService authService;

    @MockBean
    @SuppressWarnings("unused")
    private JwtTokenProvider jwtTokenProvider;

    @MockBean
    @SuppressWarnings("unused")
    private CustomUserDetailsService userDetailsService;

    @Autowired
    private ObjectMapper objectMapper;

    @Test
    @WithMockUser
    void register_Success() throws Exception {
        RegisterRequest request = new RegisterRequest();
        request.setName("John");
        request.setEmail("john@example.com");
        request.setPassword("password123");

        ApiResponse response = ApiResponse.builder()
                .status("success")
                .message("User registered successfully.")
                .build();

        when(authService.register(any(RegisterRequest.class))).thenReturn(response);

        mockMvc.perform(post("/api/v1/auth/register")
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.status").value("success"))
                .andExpect(jsonPath("$.message").value("User registered successfully."));
    }

    @Test
    @WithMockUser
    void login_Success() throws Exception {
        LoginRequest request = new LoginRequest();
        request.setEmail("john@example.com");
        request.setPassword("password123");

        AuthResponse response = AuthResponse.builder()
                .token("mock-jwt-token")
                .type("Bearer")
                .expiresIn(86400)
                .build();

        when(authService.login(any(LoginRequest.class))).thenReturn(response);

        mockMvc.perform(post("/api/v1/auth/login")
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.token").value("mock-jwt-token"));
    }
}
