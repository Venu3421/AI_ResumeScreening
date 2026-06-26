package com.project.system.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;
import java.time.LocalDateTime;

@Entity
@Table(name = "question_answer_logs")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class QuestionAnswerLog {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "session_id", referencedColumnName = "id", nullable = false)
    @ToString.Exclude
    @EqualsAndHashCode.Exclude
    private InterviewSession session;

    @Column(name = "question_text", nullable = false, columnDefinition = "TEXT")
    private String questionText;

    @Column(columnDefinition = "TEXT")
    private String transcript;

    @Column(name = "metrics_json", columnDefinition = "jsonb")
    @JdbcTypeCode(SqlTypes.JSON)
    private String metricsJson;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        if (createdAt == null) {
            createdAt = LocalDateTime.now();
        }
    }
}
