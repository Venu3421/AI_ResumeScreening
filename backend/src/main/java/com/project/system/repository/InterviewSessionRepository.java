package com.project.system.repository;

import com.project.system.entity.InterviewSession;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.Optional;

public interface InterviewSessionRepository extends JpaRepository<InterviewSession, Long> {
    List<InterviewSession> findByUserIdOrderByCreatedAtDesc(Long userId);
    List<InterviewSession> findByUserIdAndStatusOrderByCreatedAtDesc(Long userId, String status);
    List<InterviewSession> findByUserIdAndStatusOrderByCreatedAtAsc(Long userId, String status);
    Optional<InterviewSession> findByIdAndUserId(Long id, Long userId);
}
