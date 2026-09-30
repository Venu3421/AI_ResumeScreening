package com.project.system.controller;

import com.project.system.dto.*;
import com.project.system.service.InterviewService;
import jakarta.validation.Valid;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.security.Principal;
import java.util.List;

@Slf4j
@RestController
@RequestMapping("/api/v1/interview")
public class InterviewController {

    private final InterviewService interviewService;

    public InterviewController(InterviewService interviewService) {
        this.interviewService = interviewService;
    }

    @PostMapping("/start")
    public ResponseEntity<InterviewStartResponse> startSession(
            @Valid @RequestBody InterviewStartRequest request,
            Principal principal) {
        InterviewStartResponse response = interviewService.startSession(request.getJobDescription(), principal.getName());
        return new ResponseEntity<>(response, HttpStatus.CREATED);
    }

    @PostMapping("/submit-answer")
    public ResponseEntity<SubmitAnswerResponse> submitAnswer(
            @RequestParam("sessionId") Long sessionId,
            @RequestParam("questionText") String questionText,
            @RequestParam(value = "file", required = false) MultipartFile file,
            @RequestParam(value = "durationSeconds", required = false) Integer durationSeconds,
            @RequestParam(value = "interviewPresence", required = false) Integer interviewPresence,
            @RequestParam(value = "eyeContact", required = false) Integer eyeContact,
            @RequestParam(value = "bodyLanguage", required = false) Integer bodyLanguage,
            @RequestParam(value = "facialComposure", required = false) Integer facialComposure,
            @RequestParam(value = "codeAnswer", required = false) String codeAnswer,
            @RequestParam(value = "codeLanguage", required = false) String codeLanguage,
            Principal principal) {

        // Validate: at least one answer type must be provided
        boolean hasAudio = file != null && !file.isEmpty();
        boolean hasCode = codeAnswer != null && !codeAnswer.isBlank();

        if (!hasAudio && !hasCode) {
            return ResponseEntity.badRequest().build();
        }

        if (hasAudio && hasCode) {
            log.warn("Both audio file and code answer received for session {}. Preferring code answer.", sessionId);
        }

        SubmitAnswerResponse response = interviewService.submitAnswer(
                sessionId, questionText, file, principal.getName(),
                durationSeconds, interviewPresence, eyeContact, bodyLanguage, facialComposure,
                codeAnswer, codeLanguage);
        return ResponseEntity.ok(response);
    }

    @GetMapping("/sessions")
    public ResponseEntity<List<SessionHistoryResponse>> getSessionHistory(Principal principal) {
        List<SessionHistoryResponse> response = interviewService.getSessionHistory(principal.getName());
        return ResponseEntity.ok(response);
    }

    @GetMapping("/sessions/{id}")
    public ResponseEntity<SessionDetailResponse> getSessionDetail(
            @PathVariable("id") Long sessionId,
            Principal principal) {
        SessionDetailResponse response = interviewService.getSessionDetail(sessionId, principal.getName());
        return ResponseEntity.ok(response);
    }

    @GetMapping("/stats")
    public ResponseEntity<DashboardStatsResponse> getDashboardStats(Principal principal) {
        DashboardStatsResponse response = interviewService.getDashboardStats(principal.getName());
        return ResponseEntity.ok(response);
    }
}
