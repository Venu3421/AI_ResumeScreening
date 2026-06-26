package com.project.system.repository;

import com.project.system.entity.Resume;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.Optional;

public interface ResumeRepository extends JpaRepository<Resume, Long> {
    Optional<Resume> findByUserId(Long userId);
}
