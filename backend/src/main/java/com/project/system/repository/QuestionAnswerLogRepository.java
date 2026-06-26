package com.project.system.repository;

import com.project.system.entity.QuestionAnswerLog;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface QuestionAnswerLogRepository extends JpaRepository<QuestionAnswerLog, Long> {
    List<QuestionAnswerLog> findBySessionIdOrderByCreatedAtAsc(Long sessionId);
    long countBySessionId(Long sessionId);
}
