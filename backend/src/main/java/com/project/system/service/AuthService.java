package com.project.system.service;

import com.google.api.client.googleapis.auth.oauth2.GoogleIdToken;
import com.google.api.client.googleapis.auth.oauth2.GoogleIdTokenVerifier;
import com.google.api.client.http.javanet.NetHttpTransport;
import com.google.api.client.json.gson.GsonFactory;
import com.project.system.config.JwtTokenProvider;
import com.project.system.dto.*;
import com.project.system.entity.User;
import com.project.system.exception.BadRequestException;
import com.project.system.repository.UserRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.security.GeneralSecurityException;
import java.util.Arrays;
import java.util.Collections;
import java.util.List;
import java.util.UUID;

@Slf4j
@Service
public class AuthService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtTokenProvider jwtTokenProvider;
    private final CustomUserDetailsService userDetailsService;
    private final String googleClientId;

    public AuthService(
            UserRepository userRepository,
            PasswordEncoder passwordEncoder,
            JwtTokenProvider jwtTokenProvider,
            CustomUserDetailsService userDetailsService,
            @Value("${google.oauth.client-id}") String googleClientId) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.jwtTokenProvider = jwtTokenProvider;
        this.userDetailsService = userDetailsService;
        this.googleClientId = googleClientId;
    }

    public ApiResponse register(RegisterRequest request) {
        if (userRepository.existsByEmail(request.getEmail())) {
            throw new BadRequestException("Email is already registered.");
        }

        User user = User.builder()
                .name(request.getName())
                .email(request.getEmail())
                .passwordHash(passwordEncoder.encode(request.getPassword()))
                .build();

        userRepository.save(user);

        return ApiResponse.builder()
                .status("success")
                .message("User registered successfully.")
                .build();
    }

    public AuthResponse login(LoginRequest request) {
        User user = userRepository.findByEmail(request.getEmail())
                .orElseThrow(() -> new BadRequestException("Invalid email or password."));

        if (!passwordEncoder.matches(request.getPassword(), user.getPasswordHash())) {
            throw new BadRequestException("Invalid email or password.");
        }

        var userDetails = userDetailsService.loadUserByUsername(user.getEmail());
        String token = jwtTokenProvider.generateToken(userDetails);

        UserDto userDto = UserDto.builder()
                .id(user.getId())
                .name(user.getName())
                .email(user.getEmail())
                .build();

        return AuthResponse.builder()
                .token(token)
                .type("Bearer")
                .expiresIn(86400)
                .user(userDto)
                .build();
    }

    public AuthResponse googleLogin(GoogleLoginRequest request) {
        try {
            GoogleIdTokenVerifier.Builder verifierBuilder = new GoogleIdTokenVerifier.Builder(
                    new NetHttpTransport(),
                    GsonFactory.getDefaultInstance());

            // Check if valid client ID(s) are configured (ignore default/empty placeholders)
            if (googleClientId != null && !googleClientId.isBlank() && !googleClientId.contains("your-google-client-id")) {
                List<String> audiences = Arrays.stream(googleClientId.split(","))
                        .map(String::trim)
                        .filter(s -> !s.isBlank())
                        .toList();
                if (!audiences.isEmpty()) {
                    verifierBuilder.setAudience(audiences);
                }
            }

            GoogleIdTokenVerifier verifier = verifierBuilder.build();
            GoogleIdToken idToken = verifier.verify(request.getCredential());
            if (idToken == null) {
                log.warn("Google ID token verification returned null. Configured client ID: {}", googleClientId);
                throw new BadRequestException("Invalid Google ID Token.");
            }

            GoogleIdToken.Payload payload = idToken.getPayload();
            String email = payload.getEmail();
            if (email == null || email.isBlank()) {
                throw new BadRequestException("Google ID Token missing email address.");
            }

            String name = (String) payload.get("name");
            if (name == null || name.isBlank()) {
                name = (String) payload.get("given_name");
            }
            if (name == null || name.isBlank()) {
                name = email.contains("@") ? email.substring(0, email.indexOf('@')) : "Google User";
            }

            final String candidateName = name;
            User user = userRepository.findByEmail(email)
                    .orElseGet(() -> {
                        // Register Google user automatically with secure random password
                        log.info("Auto-provisioning new account for Google user: {}", email);
                        User newUser = User.builder()
                                .name(candidateName)
                                .email(email)
                                .passwordHash(passwordEncoder.encode(UUID.randomUUID().toString()))
                                .build();
                        return userRepository.save(newUser);
                    });

            var userDetails = userDetailsService.loadUserByUsername(user.getEmail());
            String token = jwtTokenProvider.generateToken(userDetails);

            UserDto userDto = UserDto.builder()
                    .id(user.getId())
                    .name(user.getName())
                    .email(user.getEmail())
                    .build();

            return AuthResponse.builder()
                    .token(token)
                    .type("Bearer")
                    .expiresIn(86400)
                    .user(userDto)
                    .build();

        } catch (GeneralSecurityException | IOException e) {
            log.error("Google ID Token verification failed: {}", e.getMessage(), e);
            throw new BadRequestException("Google ID Token verification failed: " + e.getMessage());
        }
    }
}
