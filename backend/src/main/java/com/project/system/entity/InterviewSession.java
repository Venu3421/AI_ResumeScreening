package com.project.system.entity;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;
import java.util.List;

@Entity
@Table(name = "interview_sessions")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class InterviewSession {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", referencedColumnName = "id", nullable = false)
    @ToString.Exclude
    @EqualsAndHashCode.Exclude
    private User user;

    @Column(name = "job_description", nullable = false, columnDefinition = "TEXT")
    private String jobDescription;

    @Column(nullable = false, length = 50)
    private String status; // CREATED, ACTIVE, COMPLETED

    @Column(name = "overall_score")
    @Builder.Default
    private Integer overallScore = 0;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @OneToMany(mappedBy = "session", cascade = CascadeType.ALL, orphanRemoval = true, fetch = FetchType.LAZY)
    @ToString.Exclude
    @EqualsAndHashCode.Exclude
    private List<QuestionAnswerLog> questionAnswerLogs;

    @PrePersist
    protected void onCreate() {
        if (createdAt == null) {
            createdAt = LocalDateTime.now();
        }
        if (overallScore == null) {
            overallScore = 0;
        }
    }
}
