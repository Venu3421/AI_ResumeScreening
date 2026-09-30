package com.project.system.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.project.system.config.JwtTokenProvider;
import com.project.system.dto.*;
import com.project.system.service.CustomUserDetailsService;
import com.project.system.service.InterviewService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.web.servlet.MockMvc;

import java.util.Collections;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(InterviewController.class)
public class InterviewControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private InterviewService interviewService;

    @MockBean
    @SuppressWarnings("unused")
    private JwtTokenProvider jwtTokenProvider;

    @MockBean
    @SuppressWarnings("unused")
    private CustomUserDetailsService userDetailsService;

    @Autowired
    private ObjectMapper objectMapper;

    @Test
    @WithMockUser(username = "john@example.com")
    void startSession_Success() throws Exception {
        InterviewStartRequest request = new InterviewStartRequest();
        request.setJobDescription("Java Dev");
        InterviewStartResponse response = InterviewStartResponse.builder()
                .sessionId(100L)
                .status("ACTIVE")
                .firstQuestion("What is Java?")
                .build();

        when(interviewService.startSession(eq("Java Dev"), eq("john@example.com"))).thenReturn(response);

        mockMvc.perform(post("/api/v1/interview/start")
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.sessionId").value(100L))
                .andExpect(jsonPath("$.status").value("ACTIVE"))
                .andExpect(jsonPath("$.firstQuestion").value("What is Java?"));
    }

    @Test
    @WithMockUser(username = "john@example.com")
    void submitAnswer_Success() throws Exception {
        MockMultipartFile file = new MockMultipartFile(
                "file",
                "answer.webm",
                "audio/webm",
                "audio data".getBytes()
        );

        SubmitAnswerResponse response = SubmitAnswerResponse.builder()
                .logId(200L)
                .transcript("Java is OOP")
                .evaluationMetrics(EvaluationMetricsDto.builder()
                        .technicalScore(85)
                        .communicationScore(90)
                        .professionalism(95)
                        .confidence(80)
                        .speakingPace(75)
                        .constructiveFeedback("Good job")
                        .build())
                .nextQuestion("What is Spring?")
                .build();

        when(interviewService.submitAnswer(eq(100L), eq("What is Java?"), any(), eq("john@example.com"), any(), any(), any(), any(), any(), any(), any())).thenReturn(response);

        mockMvc.perform(multipart("/api/v1/interview/submit-answer")
                        .file(file)
                        .param("sessionId", "100")
                        .param("questionText", "What is Java?")
                        .with(csrf()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.logId").value(200L))
                .andExpect(jsonPath("$.transcript").value("Java is OOP"))
                .andExpect(jsonPath("$.nextQuestion").value("What is Spring?"));
    }

    @Test
    @WithMockUser(username = "john@example.com")
    void submitAnswer_CodeAnswer_Success() throws Exception {
        SubmitAnswerResponse response = SubmitAnswerResponse.builder()
                .logId(201L)
                .transcript("function solve() { return 42; }")
                .evaluationMetrics(EvaluationMetricsDto.builder()
                        .technicalScore(90)
                        .communicationScore(85)
                        .constructiveFeedback("Good code structure")
                        .build())
                .nextQuestion("Explain your complexity.")
                .build();

        when(interviewService.submitAnswer(eq(100L), eq("Write solve()"), any(), eq("john@example.com"), any(), any(), any(), any(), any(), eq("function solve() { return 42; }"), eq("javascript"))).thenReturn(response);

        mockMvc.perform(multipart("/api/v1/interview/submit-answer")
                        .param("sessionId", "100")
                        .param("questionText", "Write solve()")
                        .param("codeAnswer", "function solve() { return 42; }")
                        .param("codeLanguage", "javascript")
                        .with(csrf()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.logId").value(201L))
                .andExpect(jsonPath("$.transcript").value("function solve() { return 42; }"))
                .andExpect(jsonPath("$.nextQuestion").value("Explain your complexity."));
    }

    @Test
    @WithMockUser(username = "john@example.com")
    void getSessionHistory_Success() throws Exception {
        SessionHistoryResponse item = SessionHistoryResponse.builder()
                .id(100L)
                .jobDescription("Java Dev")
                .status("ACTIVE")
                .overallScore(0)
                .build();

        when(interviewService.getSessionHistory("john@example.com")).thenReturn(Collections.singletonList(item));

        mockMvc.perform(get("/api/v1/interview/sessions")
                        .with(csrf()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].id").value(100L))
                .andExpect(jsonPath("$[0].jobDescription").value("Java Dev"));
    }

    @Test
    @WithMockUser(username = "john@example.com")
    void getSessionDetail_Success() throws Exception {
        SessionDetailResponse response = SessionDetailResponse.builder()
                .id(100L)
                .jobDescription("Java Dev")
                .status("ACTIVE")
                .overallScore(0)
                .logs(Collections.emptyList())
                .build();

        when(interviewService.getSessionDetail(eq(100L), eq("john@example.com"))).thenReturn(response);

        mockMvc.perform(get("/api/v1/interview/sessions/100")
                        .with(csrf()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(100L))
                .andExpect(jsonPath("$.jobDescription").value("Java Dev"));
    }

    @Test
    @WithMockUser(username = "john@example.com")
    void getDashboardStats_Success() throws Exception {
        DashboardStatsResponse statsResponse = DashboardStatsResponse.builder()
                .latestAtsScore(88)
                .avgTechnicalScore(85)
                .avgCommunicationScore(90)
                .avgConfidence(80)
                .avgSpeakingPace(140)
                .trend(Collections.singletonList(
                        DashboardStatsResponse.TrendPoint.builder()
                                .date(java.time.LocalDate.of(2026, 6, 27))
                                .overallScore(85)
                                .build()
                ))
                .build();

        when(interviewService.getDashboardStats("john@example.com")).thenReturn(statsResponse);

        mockMvc.perform(get("/api/v1/interview/stats")
                        .with(csrf()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.latestAtsScore").value(88))
                .andExpect(jsonPath("$.avgTechnicalScore").value(85))
                .andExpect(jsonPath("$.avgCommunicationScore").value(90))
                .andExpect(jsonPath("$.avgConfidence").value(80))
                .andExpect(jsonPath("$.avgSpeakingPace").value(140))
                .andExpect(jsonPath("$.trend[0].overallScore").value(85));
    }
}
