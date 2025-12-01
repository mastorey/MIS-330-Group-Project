-- ============================================================================
-- Report 01: Specialty Performance Report
-- ============================================================================
-- Description: Analyzes specialty performance including count of distinct 
--              specialties, count of specialties with bookings, total revenue
--              per specialty, average session price, and total sessions booked.
-- ============================================================================

SELECT 
    s.SpecialtyID,
    s.SpecialtyName,
    CASE WHEN COUNT(sb.SessionID) > 0 THEN 1 ELSE 0 END AS HasBookings,
    COUNT(sb.SessionID) AS TotalSessionsBooked,
    COALESCE(SUM(sb.Price), 0.00) AS TotalRevenue,
    COALESCE(AVG(sb.Price), 0.00) AS AverageSessionPrice
FROM Specialties s
LEFT JOIN SessionBooking sb ON s.SpecialtyID = sb.SpecialtyID AND sb.IsDeleted = 0
WHERE s.IsDeleted = 0
GROUP BY s.SpecialtyID, s.SpecialtyName
ORDER BY TotalRevenue DESC;

