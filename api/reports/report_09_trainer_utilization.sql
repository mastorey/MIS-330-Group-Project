-- ============================================================================
-- Report 09: Trainer Availability vs Bookings (Utilization)
-- ============================================================================
-- Description: Compares trainer availability slots with actual bookings to
--              calculate utilization rate, including total revenue generated.
-- ============================================================================

SELECT 
    u.UserID AS TrainerID,
    CONCAT(u.FirstName, ' ', u.LastName) AS TrainerName,
    COUNT(DISTINCT ta.AvailabilityID) AS TotalAvailabilitySlots,
    COUNT(sb.SessionID) AS TotalBookedSessions,
    CASE 
        WHEN COUNT(DISTINCT ta.AvailabilityID) > 0 
        THEN ROUND((COUNT(sb.SessionID) / COUNT(DISTINCT ta.AvailabilityID)) * 100, 2)
        ELSE 0.00
    END AS UtilizationRate,
    COALESCE(SUM(sb.Price), 0.00) AS RevenueGenerated
FROM Users u
INNER JOIN Trainers t ON u.UserID = t.TrainerID
LEFT JOIN TrainerAvailability ta ON t.TrainerID = ta.TrainerID AND ta.IsDeleted = 0
LEFT JOIN SessionBooking sb ON t.TrainerID = sb.TrainerID AND sb.IsDeleted = 0
WHERE u.UserType = 'Trainer'
    AND u.IsDeleted = 0
    AND t.IsDeleted = 0
GROUP BY u.UserID, u.FirstName, u.LastName
ORDER BY UtilizationRate DESC;

