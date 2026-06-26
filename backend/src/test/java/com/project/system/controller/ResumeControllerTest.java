package com.project.system.controller;

import com.project.system.config.JwtTokenProvider;
import com.project.system.dto.ResumeUploadResponse;
import com.project.system.service.CustomUserDetailsService;
import com.project.system.service.ResumeService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.web.servlet.MockMvc;

import java.util.Collections;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(ResumeController.class)
public class ResumeControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private ResumeService resumeService;

    @MockBean
    @SuppressWarnings("unused")
    private JwtTokenProvider jwtTokenProvider;

    @MockBean
    @SuppressWarnings("unused")
    private CustomUserDetailsService userDetailsService;

    @Test
    @WithMockUser(username = "john@example.com")
    void uploadResume_Success() throws Exception {
        MockMultipartFile file = new MockMultipartFile(
                "file",
                "resume.pdf",
                "application/pdf",
                "pdf content".getBytes()
        );

        ResumeUploadResponse response = ResumeUploadResponse.builder()
                .resumeId(1L)
                .atsScore(80)
                .missingKeywords(Collections.singletonList("Java"))
                .build();

        when(resumeService.uploadAndAnalyze(any(), eq("Java Dev"), eq("john@example.com"))).thenReturn(response);

        mockMvc.perform(multipart("/api/v1/resumes/upload")
                        .file(file)
                        .param("jobDescription", "Java Dev")
                        .with(csrf()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.resumeId").value(1L))
                .andExpect(jsonPath("$.atsScore").value(80));
    }

    @Test
    @WithMockUser(username = "john@example.com")
    void getResume_Success() throws Exception {
        ResumeUploadResponse response = ResumeUploadResponse.builder()
                .resumeId(1L)
                .atsScore(80)
                .missingKeywords(Collections.singletonList("Java"))
                .build();

        when(resumeService.getResume("john@example.com")).thenReturn(response);

        mockMvc.perform(get("/api/v1/resumes")
                        .with(csrf()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.resumeId").value(1L));
    }
}
