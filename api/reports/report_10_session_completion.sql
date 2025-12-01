-- ============================================================================
-- Report 10: Session Completion Analysis
-- ============================================================================
-- Description: Analyzes session completion rates overall, by specialty, and 
--              by trainer, including cancellation rates and revenue lost from
--              cancellations.
-- ============================================================================

-- Overall completion and cancellation rates
SELECT 
    'Overall' AS Category,
    'All Sessions' AS SubCategory,
    COUNT(sb.SessionID) AS TotalSessions,
    COUNT(CASE WHEN sb.Status = 'Completed' THEN 1 END) AS CompletedSessions,
    COUNT(CASE WHEN sb.Status = 'Cancelled' THEN 1 END) AS CancelledSessions,
    ROUND((COUNT(CASE WHEN sb.Status = 'Completed' THEN 1 END) / NULLIF(COUNT(sb.SessionID), 0)) * 100, 2) AS CompletionRate,
    ROUND((COUNT(CASE WHEN sb.Status = 'Cancelled' THEN 1 END) / NULLIF(COUNT(sb.SessionID), 0)) * 100, 2) AS CancellationRate,
    COALESCE(SUM(CASE WHEN sb.Status = 'Cancelled' THEN sb.Price ELSE 0 END), 0.00) AS RevenueLostFromCancellations
FROM SessionBooking sb
WHERE sb.IsDeleted = 0

UNION ALL

-- Breakdown by specialty
SELECT 
    'By Specialty' AS Category,
    s.SpecialtyName AS SubCategory,
    COUNT(sb.SessionID) AS TotalSessions,
    COUNT(CASE WHEN sb.Status = 'Completed' THEN 1 END) AS CompletedSessions,
    COUNT(CASE WHEN sb.Status = 'Cancelled' THEN 1 END) AS CancelledSessions,
    ROUND((COUNT(CASE WHEN sb.Status = 'Completed' THEN 1 END) / NULLIF(COUNT(sb.SessionID), 0)) * 100, 2) AS CompletionRate,
    ROUND((COUNT(CASE WHEN sb.Status = 'Cancelled' THEN 1 END) / NULLIF(COUNT(sb.SessionID), 0)) * 100, 2) AS CancellationRate,
    COALESCE(SUM(CASE WHEN sb.Status = 'Cancelled' THEN sb.Price ELSE 0 END), 0.00) AS RevenueLostFromCancellations
FROM SessionBooking sb
INNER JOIN Specialties s ON sb.SpecialtyID = s.SpecialtyID
WHERE sb.IsDeleted = 0
    AND s.IsDeleted = 0
GROUP BY s.SpecialtyName

UNION ALL

-- Breakdown by trainer
SELECT 
    'By Trainer' AS Category,
    CONCAT(u.FirstName, ' ', u.LastName) AS SubCategory,
    COUNT(sb.SessionID) AS TotalSessions,
    COUNT(CASE WHEN sb.Status = 'Completed' THEN 1 END) AS CompletedSessions,
    COUNT(CASE WHEN sb.Status = 'Cancelled' THEN 1 END) AS CancelledSessions,
    ROUND((COUNT(CASE WHEN sb.Status = 'Completed' THEN 1 END) / NULLIF(COUNT(sb.SessionID), 0)) * 100, 2) AS CompletionRate,
    ROUND((COUNT(CASE WHEN sb.Status = 'Cancelled' THEN 1 END) / NULLIF(COUNT(sb.SessionID), 0)) * 100, 2) AS CancellationRate,
    COALESCE(SUM(CASE WHEN sb.Status = 'Cancelled' THEN sb.Price ELSE 0 END), 0.00) AS RevenueLostFromCancellations
FROM SessionBooking sb
INNER JOIN Trainers t ON sb.TrainerID = t.TrainerID
INNER JOIN Users u ON t.TrainerID = u.UserID
WHERE sb.IsDeleted = 0
    AND t.IsDeleted = 0
    AND u.IsDeleted = 0
GROUP BY u.UserID, u.FirstName, u.LastName

ORDER BY Category, CompletionRate DESC;

