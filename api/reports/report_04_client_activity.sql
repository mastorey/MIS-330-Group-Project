-- ============================================================================
-- Report 04: Client Activity Report
-- ============================================================================
-- Description: Analyzes client activity including total sessions booked,
--              total amount spent, average session price, and most recent 
--              booking date.
-- ============================================================================

SELECT 
    u.UserID AS ClientID,
    CONCAT(u.FirstName, ' ', u.LastName) AS ClientName,
    u.Email AS ClientEmail,
    c.JoinDate,
    COUNT(sb.SessionID) AS TotalSessionsBooked,
    COALESCE(SUM(sb.Price), 0.00) AS TotalAmountSpent,
    COALESCE(AVG(sb.Price), 0.00) AS AverageSessionPrice,
    MAX(sb.BookingDate) AS MostRecentBookingDate
FROM Users u
INNER JOIN Clients c ON u.UserID = c.ClientID
LEFT JOIN SessionBooking sb ON c.ClientID = sb.ClientID AND sb.IsDeleted = 0
WHERE u.UserType = 'Client'
    AND u.IsDeleted = 0
    AND c.IsDeleted = 0
GROUP BY u.UserID, u.FirstName, u.LastName, u.Email, c.JoinDate
ORDER BY TotalAmountSpent DESC;

