package com.project.system.controller;

import com.project.system.dto.*;
import com.project.system.service.InterviewService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.security.Principal;
import java.util.List;

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
            @RequestParam("file") MultipartFile file,
            Principal principal) {
        SubmitAnswerResponse response = interviewService.submitAnswer(sessionId, questionText, file, principal.getName());
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
}
