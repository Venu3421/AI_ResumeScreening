package com.project.system.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.project.system.dto.*;
import com.project.system.entity.InterviewSession;
import com.project.system.entity.QuestionAnswerLog;
import com.project.system.entity.User;
import com.project.system.repository.InterviewSessionRepository;
import com.project.system.repository.QuestionAnswerLogRepository;
import com.project.system.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestTemplate;

import java.util.*;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.method;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;

@ExtendWith(MockitoExtension.class)
public class InterviewServiceTest {

    @Mock
    private InterviewSessionRepository sessionRepository;

    @Mock
    private QuestionAnswerLogRepository logRepository;

    @Mock
    private UserRepository userRepository;

    private final ObjectMapper objectMapper = new ObjectMapper();

    private InterviewService interviewService;
    private MockRestServiceServer mockServer;

    @BeforeEach
    public void setUp() {
        interviewService = new InterviewService(sessionRepository, logRepository, userRepository, objectMapper);
        ReflectionTestUtils.setField(interviewService, "aiServiceUrl", "http://localhost:8000");
        RestTemplate restTemplate = (RestTemplate) ReflectionTestUtils.getField(interviewService, "restTemplate");
        mockServer = MockRestServiceServer.createServer(restTemplate);
    }

    @Test
    public void startSession_Success() throws Exception {
        String userEmail = "john@example.com";
        User user = User.builder().id(1L).email(userEmail).name("John").build();
        when(userRepository.findByEmail(userEmail)).thenReturn(Optional.of(user));

        Map<String, String> aiResponse = new HashMap<>();
        aiResponse.put("question", "What is Java?");

        mockServer.expect(requestTo("http://localhost:8000/api/v1/ai/generate-question"))
                .andExpect(method(HttpMethod.POST))
                .andRespond(withSuccess(objectMapper.writeValueAsString(aiResponse), MediaType.APPLICATION_JSON));

        InterviewSession savedSession = InterviewSession.builder()
                .id(100L)
                .user(user)
                .jobDescription("Java Dev")
                .status("ACTIVE")
                .overallScore(0)
                .build();
        when(sessionRepository.save(any(InterviewSession.class))).thenReturn(savedSession);

        InterviewStartResponse response = interviewService.startSession("Java Dev", userEmail);

        assertNotNull(response);
        assertEquals(100L, response.getSessionId());
        assertEquals("ACTIVE", response.getStatus());
        assertEquals("What is Java?", response.getFirstQuestion());
        verify(logRepository, times(1)).save(any(QuestionAnswerLog.class));
        mockServer.verify();
    }

    @Test
    public void submitAnswer_Success_ProgressToNextQuestion() throws Exception {
        String userEmail = "john@example.com";
        User user = User.builder().id(1L).email(userEmail).name("John").build();
        InterviewSession session = InterviewSession.builder()
                .id(100L)
                .user(user)
                .jobDescription("Java Dev")
                .status("ACTIVE")
                .overallScore(0)
                .build();

        MockMultipartFile audioFile = new MockMultipartFile(
                "file",
                "answer.webm",
                "audio/webm",
                new byte[2048]
        );

        QuestionAnswerLog activeLog = QuestionAnswerLog.builder()
                .id(200L)
                .session(session)
                .questionText("What is Java?")
                .build();

        List<QuestionAnswerLog> logs = new ArrayList<>();
        logs.add(activeLog);

        when(sessionRepository.findById(100L)).thenReturn(Optional.of(session));
        when(logRepository.findBySessionIdOrderByCreatedAtAsc(100L)).thenReturn(logs);

        Map<String, Object> aiResponseMap = new HashMap<>();
        aiResponseMap.put("transcript", "Java is a programming language");
        
        Map<String, Object> metrics = new HashMap<>();
        metrics.put("technicalAccuracy", 80);
        metrics.put("communicationClarity", 90);
        metrics.put("structuralLogic", 85);
        metrics.put("constructiveFeedback", "Good response");
        aiResponseMap.put("evaluation_metrics", metrics);
        aiResponseMap.put("next_question", "What is Spring?");

        mockServer.expect(requestTo("http://localhost:8000/api/v1/ai/evaluate-answer"))
                .andExpect(method(HttpMethod.POST))
                .andRespond(withSuccess(objectMapper.writeValueAsString(aiResponseMap), MediaType.APPLICATION_JSON));

        SubmitAnswerResponse response = interviewService.submitAnswer(100L, "What is Java?", audioFile, userEmail);

        assertNotNull(response);
        assertEquals("Java is a programming language", response.getTranscript());
        assertEquals(80, response.getEvaluationMetrics().getTechnicalAccuracy());
        assertEquals("What is Spring?", response.getNextQuestion());

        verify(logRepository, times(2)).save(any(QuestionAnswerLog.class));
        mockServer.verify();
    }

    @Test
    public void submitAnswer_FinalQuestion_CompletesSession() throws Exception {
        String userEmail = "john@example.com";
        User user = User.builder().id(1L).email(userEmail).name("John").build();
        InterviewSession session = InterviewSession.builder()
                .id(100L)
                .user(user)
                .jobDescription("Java Dev")
                .status("ACTIVE")
                .overallScore(0)
                .build();

        MockMultipartFile audioFile = new MockMultipartFile(
                "file",
                "answer.webm",
                "audio/webm",
                new byte[2048]
        );

        List<QuestionAnswerLog> logs = new ArrayList<>();
        for (int i = 1; i <= 5; i++) {
            QuestionAnswerLog log = QuestionAnswerLog.builder()
                    .id((long) i)
                    .session(session)
                    .questionText("Question " + i)
                    .build();
            if (i < 5) {
                log.setTranscript("Transcript " + i);
                log.setMetricsJson("{\"technicalAccuracy\":80,\"communicationClarity\":80,\"structuralLogic\":80}");
            }
            logs.add(log);
        }

        when(sessionRepository.findById(100L)).thenReturn(Optional.of(session));
        when(logRepository.findBySessionIdOrderByCreatedAtAsc(100L)).thenReturn(logs);

        Map<String, Object> aiResponseMap = new HashMap<>();
        aiResponseMap.put("transcript", "Answer 5");
        
        Map<String, Object> metrics = new HashMap<>();
        metrics.put("technicalAccuracy", 90);
        metrics.put("communicationClarity", 90);
        metrics.put("structuralLogic", 90);
        metrics.put("constructiveFeedback", "Great end");
        aiResponseMap.put("evaluation_metrics", metrics);
        aiResponseMap.put("next_question", null);

        mockServer.expect(requestTo("http://localhost:8000/api/v1/ai/evaluate-answer"))
                .andExpect(method(HttpMethod.POST))
                .andRespond(withSuccess(objectMapper.writeValueAsString(aiResponseMap), MediaType.APPLICATION_JSON));

        SubmitAnswerResponse response = interviewService.submitAnswer(100L, "Question 5", audioFile, userEmail);

        assertNotNull(response);
        assertNull(response.getNextQuestion());
        assertEquals("COMPLETED", session.getStatus());
        assertEquals(82, session.getOverallScore());
        mockServer.verify();
    }
}
