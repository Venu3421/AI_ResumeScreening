package com.project.system.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.project.system.dto.ResumeUploadResponse;
import com.project.system.entity.Resume;
import com.project.system.entity.User;
import com.project.system.exception.BadRequestException;
import com.project.system.repository.ResumeRepository;
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

import java.util.Arrays;
import java.util.HashMap;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.method;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;

@ExtendWith(MockitoExtension.class)
public class ResumeServiceTest {

    @Mock
    private ResumeRepository resumeRepository;

    @Mock
    private UserRepository userRepository;

    private final ObjectMapper objectMapper = new ObjectMapper();

    private ResumeService resumeService;
    private MockRestServiceServer mockServer;

    @BeforeEach
    public void setUp() {
        resumeService = new ResumeService(resumeRepository, userRepository, objectMapper);
        ReflectionTestUtils.setField(resumeService, "aiServiceUrl", "http://localhost:8000");
        RestTemplate restTemplate = (RestTemplate) ReflectionTestUtils.getField(resumeService, "restTemplate");
        mockServer = MockRestServiceServer.createServer(restTemplate);
    }

    @Test
    public void uploadAndAnalyze_Success() throws Exception {
        MockMultipartFile file = new MockMultipartFile(
                "file",
                "resume.pdf",
                "application/pdf",
                "This is candidate resume text that contains experience with Java and Spring Boot. It has more than 50 characters to pass validation.".getBytes()
        );

        String userEmail = "john@example.com";
        User user = User.builder().id(1L).email(userEmail).name("John").build();
        when(userRepository.findByEmail(userEmail)).thenReturn(Optional.of(user));

        Map<String, Object> aiResponseMap = new HashMap<>();
        aiResponseMap.put("ats_score", 85);
        aiResponseMap.put("missing_keywords", Arrays.asList("Java", "Spring"));
        aiResponseMap.put("strengths", Arrays.asList("Experience", "Skills"));
        aiResponseMap.put("weaknesses", Arrays.asList("No Docker"));
        aiResponseMap.put("suggestions", Arrays.asList("Add Docker"));
        aiResponseMap.put("generated_questions", Arrays.asList("Q1", "Q2"));

        mockServer.expect(requestTo("http://localhost:8000/api/v1/ai/analyze-resume"))
                .andExpect(method(HttpMethod.POST))
                .andRespond(withSuccess(objectMapper.writeValueAsString(aiResponseMap), MediaType.APPLICATION_JSON));

        when(resumeRepository.findByUserId(1L)).thenReturn(Optional.empty());

        ResumeUploadResponse response = resumeService.uploadAndAnalyze(file, "Java Dev", userEmail);

        assertNotNull(response);
        assertEquals(85, response.getAtsScore());
        verify(resumeRepository, times(1)).save(any(Resume.class));
        mockServer.verify();
    }

    @Test
    public void uploadAndAnalyze_EmptyFile_ThrowsBadRequestException() {
        MockMultipartFile file = new MockMultipartFile("file", "", "application/pdf", new byte[0]);

        BadRequestException ex = assertThrows(BadRequestException.class, () -> 
            resumeService.uploadAndAnalyze(file, "Java Dev", "john@example.com")
        );
        assertNotNull(ex.getMessage());
    }

    @Test
    public void uploadAndAnalyze_NonPdfFile_ThrowsBadRequestException() {
        MockMultipartFile file = new MockMultipartFile("file", "photo.png", "image/png", "image content".getBytes());

        BadRequestException ex = assertThrows(BadRequestException.class, () -> 
            resumeService.uploadAndAnalyze(file, "Java Dev", "john@example.com")
        );
        assertNotNull(ex.getMessage());
    }

    @Test
    public void uploadAndAnalyze_FileTooLarge_ThrowsBadRequestException() {
        MockMultipartFile file = new MockMultipartFile("file", "resume.pdf", "application/pdf", new byte[6 * 1024 * 1024]); // 6MB

        BadRequestException ex = assertThrows(BadRequestException.class, () -> 
            resumeService.uploadAndAnalyze(file, "Java Dev", "john@example.com")
        );
        assertNotNull(ex.getMessage());
    }

    @Test
    public void getResume_NotFound_ReturnsNull() {
        String userEmail = "john@example.com";
        User user = User.builder().id(1L).email(userEmail).name("John").build();
        when(userRepository.findByEmail(userEmail)).thenReturn(Optional.of(user));
        when(resumeRepository.findByUserId(1L)).thenReturn(Optional.empty());

        ResumeUploadResponse response = resumeService.getResume(userEmail);
        assertNull(response);
    }
}
