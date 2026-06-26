package com.project.system.controller;

import com.project.system.dto.ResumeUploadResponse;
import com.project.system.service.ResumeService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.security.Principal;

@RestController
@RequestMapping("/api/v1/resumes")
public class ResumeController {

    private final ResumeService resumeService;

    public ResumeController(ResumeService resumeService) {
        this.resumeService = resumeService;
    }

    @PostMapping("/upload")
    public ResponseEntity<ResumeUploadResponse> uploadResume(
            @RequestParam("file") MultipartFile file,
            @RequestParam("jobDescription") String jobDescription,
            Principal principal) {
        ResumeUploadResponse response = resumeService.uploadAndAnalyze(file, jobDescription, principal.getName());
        return ResponseEntity.ok(response);
    }

    @GetMapping
    public ResponseEntity<ResumeUploadResponse> getResume(Principal principal) {
        ResumeUploadResponse response = resumeService.getResume(principal.getName());
        if (response == null) {
            return ResponseEntity.noContent().build();
        }
        return ResponseEntity.ok(response);
    }
}
