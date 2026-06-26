package com.project.system.service;

import com.project.system.config.JwtTokenProvider;
import com.project.system.dto.*;
import com.project.system.entity.User;
import com.project.system.exception.BadRequestException;
import com.project.system.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
public class AuthServiceTest {

    @Mock
    private UserRepository userRepository;

    @Mock
    private PasswordEncoder passwordEncoder;

    private JwtTokenProvider jwtTokenProvider;
    private CustomUserDetailsService userDetailsService;
    private AuthService authService;

    @BeforeEach
    public void setUp() {
        jwtTokenProvider = new JwtTokenProvider(
                "InterviewIQ_AI_2024_Super_Secure_JWT_Secret_Key_64_Characters_Long_!!",
                86400000L
        );
        userDetailsService = new CustomUserDetailsService(userRepository);
        authService = new AuthService(userRepository, passwordEncoder, jwtTokenProvider, userDetailsService, "mock-google-client-id");
    }

    @Test
    public void register_Success() {
        RegisterRequest request = new RegisterRequest();
        request.setName("John Doe");
        request.setEmail("john@example.com");
        request.setPassword("password123");

        when(userRepository.existsByEmail(request.getEmail())).thenReturn(false);
        when(passwordEncoder.encode(request.getPassword())).thenReturn("encodedPassword");

        ApiResponse response = authService.register(request);

        assertNotNull(response);
        assertEquals("success", response.getStatus());
        assertEquals("User registered successfully.", response.getMessage());

        verify(userRepository, times(1)).save(any(User.class));
    }

    @Test
    public void register_DuplicateEmail_ThrowsBadRequestException() {
        RegisterRequest request = new RegisterRequest();
        request.setName("John Doe");
        request.setEmail("john@example.com");
        request.setPassword("password123");

        when(userRepository.existsByEmail(request.getEmail())).thenReturn(true);

        BadRequestException ex = assertThrows(BadRequestException.class, () -> authService.register(request));
        assertNotNull(ex.getMessage());
        verify(userRepository, never()).save(any(User.class));
    }

    @Test
    public void login_Success() {
        LoginRequest request = new LoginRequest();
        request.setEmail("john@example.com");
        request.setPassword("password123");

        User user = User.builder()
                .id(1L)
                .name("John Doe")
                .email("john@example.com")
                .passwordHash("encodedPassword")
                .build();

        when(userRepository.findByEmail(request.getEmail())).thenReturn(Optional.of(user));
        when(passwordEncoder.matches(request.getPassword(), user.getPasswordHash())).thenReturn(true);

        AuthResponse response = authService.login(request);

        assertNotNull(response);
        assertNotNull(response.getToken());
        assertEquals("Bearer", response.getType());
        assertEquals("John Doe", response.getUser().getName());
        assertEquals("john@example.com", response.getUser().getEmail());
    }

    @Test
    public void login_UserNotFound_ThrowsBadRequestException() {
        LoginRequest request = new LoginRequest();
        request.setEmail("nonexistent@example.com");
        request.setPassword("password123");

        when(userRepository.findByEmail(request.getEmail())).thenReturn(Optional.empty());

        BadRequestException ex = assertThrows(BadRequestException.class, () -> authService.login(request));
        assertNotNull(ex.getMessage());
    }

    @Test
    public void login_InvalidPassword_ThrowsBadRequestException() {
        LoginRequest request = new LoginRequest();
        request.setEmail("john@example.com");
        request.setPassword("wrongpassword");

        User user = User.builder()
                .id(1L)
                .name("John Doe")
                .email("john@example.com")
                .passwordHash("encodedPassword")
                .build();

        when(userRepository.findByEmail(request.getEmail())).thenReturn(Optional.of(user));
        when(passwordEncoder.matches(request.getPassword(), user.getPasswordHash())).thenReturn(false);

        BadRequestException ex = assertThrows(BadRequestException.class, () -> authService.login(request));
        assertNotNull(ex.getMessage());
    }
}
