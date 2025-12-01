-- ============================================================================
-- Report 02: Trainer Performance Report
-- ============================================================================
-- Description: Analyzes trainer performance including total revenue generated,
--              total sessions booked, average rate per hour, average session 
--              price, and completion rate (completed vs total sessions).
-- ============================================================================

SELECT 
    u.UserID AS TrainerID,
    CONCAT(u.FirstName, ' ', u.LastName) AS TrainerName,
    u.Email AS TrainerEmail,
    COALESCE(t.Rate, 0.00) AS AverageRatePerHour,
    COUNT(sb.SessionID) AS TotalSessionsBooked,
    COUNT(CASE WHEN sb.Status = 'Completed' THEN 1 END) AS CompletedSessions,
    CASE 
        WHEN COUNT(sb.SessionID) > 0 
        THEN ROUND((COUNT(CASE WHEN sb.Status = 'Completed' THEN 1 END) / COUNT(sb.SessionID)) * 100, 2)
        ELSE 0.00
    END AS CompletionRate,
    COALESCE(SUM(sb.Price), 0.00) AS TotalRevenue,
    COALESCE(AVG(sb.Price), 0.00) AS AverageSessionPrice
FROM Users u
INNER JOIN Trainers t ON u.UserID = t.TrainerID
LEFT JOIN SessionBooking sb ON t.TrainerID = sb.TrainerID AND sb.IsDeleted = 0
WHERE u.UserType = 'Trainer'
    AND u.IsDeleted = 0
    AND t.IsDeleted = 0
GROUP BY u.UserID, u.FirstName, u.LastName, u.Email, t.Rate
ORDER BY TotalRevenue DESC;

