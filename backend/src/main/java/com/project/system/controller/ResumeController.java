package com.project.system.controller;

import com.project.system.dto.ResumeUploadResponse;
import com.project.system.service.ResumeService;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
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

    /**
     * Retrieve the original PDF file for the authenticated user's resume.
     * Returns 404 if no resume exists or no PDF is stored.
     */
    @GetMapping("/file")
    public ResponseEntity<byte[]> getResumeFile(Principal principal) {
        byte[] pdfData = resumeService.getResumeFile(principal.getName());
        if (pdfData == null || pdfData.length == 0) {
            return ResponseEntity.notFound().build();
        }
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_PDF);
        headers.setContentDispositionFormData("inline", "resume.pdf");
        return ResponseEntity.ok().headers(headers).body(pdfData);
    }

    /**
     * Non-blocking background health ping to pre-warm the AI microservice on Render free tier.
     */
    @GetMapping("/ping-ai")
    public ResponseEntity<java.util.Map<String, Object>> pingAi() {
        return ResponseEntity.ok(resumeService.pingAiService());
    }
}
