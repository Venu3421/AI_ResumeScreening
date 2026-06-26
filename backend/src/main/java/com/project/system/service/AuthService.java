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
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.security.GeneralSecurityException;
import java.util.Collections;
import java.util.UUID;

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
            GoogleIdTokenVerifier verifier = new GoogleIdTokenVerifier.Builder(
                    new NetHttpTransport(),
                    GsonFactory.getDefaultInstance())
                    .setAudience(Collections.singletonList(googleClientId))
                    .build();

            GoogleIdToken idToken = verifier.verify(request.getCredential());
            if (idToken == null) {
                throw new BadRequestException("Invalid Google ID Token.");
            }

            GoogleIdToken.Payload payload = idToken.getPayload();
            String email = payload.getEmail();
            String name = (String) payload.get("name");

            User user = userRepository.findByEmail(email)
                    .orElseGet(() -> {
                        // Register Google user automatically with random password
                        User newUser = User.builder()
                                .name(name)
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
            throw new BadRequestException("Google ID Token verification failed: " + e.getMessage());
        }
    }
}
