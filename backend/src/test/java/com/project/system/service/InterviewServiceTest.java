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

import com.project.system.exception.BadRequestException;

import java.time.LocalDateTime;
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

    @Mock
    private com.project.system.repository.ResumeRepository resumeRepository;

    private final ObjectMapper objectMapper = new ObjectMapper();

    private InterviewService interviewService;
    private MockRestServiceServer mockServer;

    @BeforeEach
    public void setUp() {
        interviewService = new InterviewService(sessionRepository, logRepository, userRepository, resumeRepository, objectMapper);
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
        metrics.put("technicalScore", 80);
        metrics.put("communicationScore", 90);
        metrics.put("professionalism", 85);
        metrics.put("confidence", 80);
        metrics.put("constructiveFeedback", "Good response");
        aiResponseMap.put("evaluation_metrics", metrics);
        aiResponseMap.put("next_question", "What is Spring?");

        mockServer.expect(requestTo("http://localhost:8000/api/v1/ai/evaluate-answer"))
                .andExpect(method(HttpMethod.POST))
                .andRespond(withSuccess(objectMapper.writeValueAsString(aiResponseMap), MediaType.APPLICATION_JSON));

        SubmitAnswerResponse response = interviewService.submitAnswer(100L, "What is Java?", audioFile, userEmail, null, null, null, null, null);

        assertNotNull(response);
        assertEquals("Java is a programming language", response.getTranscript());
        assertEquals(80, response.getEvaluationMetrics().getTechnicalScore());
        assertEquals("What is Spring?", response.getNextQuestion());

        verify(logRepository, times(2)).save(any(QuestionAnswerLog.class));
        mockServer.verify();
    }

    @Test
    public void submitAnswer_MultilineQuestionWithCrlf_MatchesAndProgressesSuccessfully() throws Exception {
        String userEmail = "john@example.com";
        User user = User.builder().id(1L).email(userEmail).name("John").build();
        InterviewSession session = InterviewSession.builder()
                .id(100L)
                .user(user)
                .jobDescription("Full Stack Dev")
                .status("ACTIVE")
                .overallScore(0)
                .build();

        // Stored question in DB has \n (LF) line breaks
        String dbQuestion = "Write a SQL query:\n1. orders table\n2. customers table\nFind orphaned orders.";
        QuestionAnswerLog activeLog = QuestionAnswerLog.builder()
                .id(200L)
                .session(session)
                .questionText(dbQuestion)
                .build();

        List<QuestionAnswerLog> logs = new ArrayList<>();
        logs.add(activeLog);

        when(sessionRepository.findById(100L)).thenReturn(Optional.of(session));
        when(logRepository.findBySessionIdOrderByCreatedAtAsc(100L)).thenReturn(logs);

        Map<String, Object> aiResponseMap = new HashMap<>();
        aiResponseMap.put("transcript", "SELECT * FROM orders LEFT JOIN customers...");

        Map<String, Object> metrics = new HashMap<>();
        metrics.put("technicalScore", 100);
        metrics.put("communicationScore", 95);
        aiResponseMap.put("evaluation_metrics", metrics);
        aiResponseMap.put("next_question", "Explain indexing in PostgreSQL.");

        mockServer.expect(requestTo("http://localhost:8000/api/v1/ai/evaluate-code-answer"))
                .andExpect(method(HttpMethod.POST))
                .andRespond(withSuccess(objectMapper.writeValueAsString(aiResponseMap), MediaType.APPLICATION_JSON));

        // Browser submitted question has \r\n (CRLF) line breaks
        String submittedQuestion = "Write a SQL query:\r\n1. orders table\r\n2. customers table\r\nFind orphaned orders.";
        String codeAnswer = "SELECT o.order_id FROM orders o LEFT JOIN customers c ON o.customer_id = c.customer_id WHERE c.customer_id IS NULL;";

        SubmitAnswerResponse response = interviewService.submitAnswer(
                100L, submittedQuestion, null, userEmail,
                null, null, null, null, null,
                codeAnswer, "sql");

        assertNotNull(response);
        assertEquals(100, response.getEvaluationMetrics().getTechnicalScore());
        assertEquals("Explain indexing in PostgreSQL.", response.getNextQuestion());
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
        metrics.put("technicalScore", 90);
        metrics.put("communicationScore", 90);
        metrics.put("professionalism", 90);
        metrics.put("confidence", 90);
        metrics.put("constructiveFeedback", "Great end");
        aiResponseMap.put("evaluation_metrics", metrics);
        aiResponseMap.put("next_question", null);

        mockServer.expect(requestTo("http://localhost:8000/api/v1/ai/evaluate-answer"))
                .andExpect(method(HttpMethod.POST))
                .andRespond(withSuccess(objectMapper.writeValueAsString(aiResponseMap), MediaType.APPLICATION_JSON));

        SubmitAnswerResponse response = interviewService.submitAnswer(100L, "Question 5", audioFile, userEmail, null, null, null, null, null);

        assertNotNull(response);
        assertNull(response.getNextQuestion());
        assertEquals("COMPLETED", session.getStatus());
        assertEquals(82, session.getOverallScore());
        mockServer.verify();
    }

    @Test
    public void submitAnswer_ExpiredSession_ThrowsBadRequestException() {
        String userEmail = "john@example.com";
        User user = User.builder().id(1L).email(userEmail).name("John").build();
        InterviewSession session = InterviewSession.builder()
                .id(100L)
                .user(user)
                .jobDescription("Java Dev")
                .status("ACTIVE")
                .createdAt(LocalDateTime.now().minusHours(25))
                .build();

        MockMultipartFile audioFile = new MockMultipartFile(
                "file",
                "answer.webm",
                "audio/webm",
                new byte[2048]
        );

        when(sessionRepository.findById(100L)).thenReturn(Optional.of(session));

        BadRequestException ex = assertThrows(BadRequestException.class, () ->
                interviewService.submitAnswer(100L, "Question 1", audioFile, userEmail, null, null, null, null, null)
        );

        assertTrue(ex.getMessage().contains("expired"));
    }

    @Test
    public void getDashboardStats_ZeroSessions_ReturnsHonestNulls() {
        String userEmail = "john@example.com";
        User user = User.builder().id(1L).email(userEmail).name("John").build();
        when(userRepository.findByEmail(userEmail)).thenReturn(Optional.of(user));
        when(resumeRepository.findTopByUserIdOrderByUpdatedAtDesc(1L)).thenReturn(Optional.empty());
        when(resumeRepository.findByUserId(1L)).thenReturn(Optional.empty());
        when(sessionRepository.findByUserIdAndStatusOrderByCreatedAtAsc(1L, "COMPLETED")).thenReturn(Collections.emptyList());

        DashboardStatsResponse stats = interviewService.getDashboardStats(userEmail);

        assertNotNull(stats);
        assertNull(stats.getLatestAtsScore());
        assertNull(stats.getAvgTechnicalScore());
        assertNull(stats.getAvgCommunicationScore());
        assertNull(stats.getAvgConfidence());
        assertNull(stats.getAvgSpeakingPace());
        assertNotNull(stats.getTrend());
        assertTrue(stats.getTrend().isEmpty());
    }

    @Test
    public void getDashboardStats_WithCompletedSessions_ComputesAveragesAndTrend() {
        String userEmail = "john@example.com";
        User user = User.builder().id(1L).email(userEmail).name("John").build();
        when(userRepository.findByEmail(userEmail)).thenReturn(Optional.of(user));

        com.project.system.entity.Resume resume = com.project.system.entity.Resume.builder()
                .id(10L)
                .user(user)
                .atsScore(92)
                .rawText("Resume text")
                .feedbackJson("{}")
                .build();
        when(resumeRepository.findTopByUserIdOrderByUpdatedAtDesc(1L)).thenReturn(Optional.of(resume));

        InterviewSession session1 = InterviewSession.builder()
                .id(101L)
                .user(user)
                .status("COMPLETED")
                .overallScore(80)
                .createdAt(java.time.LocalDateTime.of(2026, 6, 27, 10, 0))
                .build();

        InterviewSession session2 = InterviewSession.builder()
                .id(102L)
                .user(user)
                .status("COMPLETED")
                .overallScore(90)
                .createdAt(java.time.LocalDateTime.of(2026, 6, 28, 14, 0))
                .build();

        when(sessionRepository.findByUserIdAndStatusOrderByCreatedAtAsc(1L, "COMPLETED"))
                .thenReturn(Arrays.asList(session1, session2));

        QuestionAnswerLog log1 = QuestionAnswerLog.builder()
                .id(1L)
                .metricsJson("{\"technicalScore\":80,\"communicationScore\":85,\"confidence\":75,\"speakingPace\":130}")
                .build();
        QuestionAnswerLog log2 = QuestionAnswerLog.builder()
                .id(2L)
                .metricsJson("{\"technicalScore\":90,\"communicationScore\":95,\"confidence\":85,\"speakingPace\":null}") // code-mode answer, null speaking pace
                .build();

        when(logRepository.findBySessionIdOrderByCreatedAtAsc(101L)).thenReturn(Collections.singletonList(log1));
        when(logRepository.findBySessionIdOrderByCreatedAtAsc(102L)).thenReturn(Collections.singletonList(log2));

        DashboardStatsResponse stats = interviewService.getDashboardStats(userEmail);

        assertNotNull(stats);
        assertEquals(92, stats.getLatestAtsScore());
        assertEquals(85, stats.getAvgTechnicalScore()); // (80 + 90) / 2
        assertEquals(90, stats.getAvgCommunicationScore()); // (85 + 95) / 2
        assertEquals(80, stats.getAvgConfidence()); // (75 + 85) / 2
        assertEquals(130, stats.getAvgSpeakingPace()); // Only non-null value: 130 (null skipped!)
        assertEquals(2, stats.getTrend().size());
        assertEquals(80, stats.getTrend().get(0).getOverallScore());
        assertEquals(90, stats.getTrend().get(1).getOverallScore());
    }
}
