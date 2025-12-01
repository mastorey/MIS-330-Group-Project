-- Report 01: Specialty Performance Report
SELECT s.SpecialtyID, s.SpecialtyName,
    IF(COUNT(sb.SessionID) > 0, 'Yes', 'No') AS HasBookings,
    COUNT(sb.SessionID) AS TotalSessionsBooked,
    IFNULL(SUM(sb.Price), 0.00) AS TotalRevenue,
    ROUND(IFNULL(AVG(sb.Price), 0.00), 2) AS AverageSessionPrice
FROM Specialties s
LEFT JOIN SessionBooking sb ON s.SpecialtyID = sb.SpecialtyID AND sb.IsDeleted = 0
WHERE s.IsDeleted = 0
GROUP BY s.SpecialtyID, s.SpecialtyName
ORDER BY TotalRevenue DESC;

-- Report 02: Trainer Performance Report
SELECT u.UserID AS TrainerID, CONCAT(u.FirstName, ' ', u.LastName) AS TrainerName,
    u.Email AS TrainerEmail, COALESCE(t.Rate, 0.00) AS AverageRatePerHour,
    COUNT(sb.SessionID) AS TotalSessionsBooked, COUNT(CASE WHEN sb.Status = 'Completed' THEN 1 END) AS CompletedSessions,
    CASE 
        WHEN COUNT(sb.SessionID) > 0 
        THEN ROUND((COUNT(CASE WHEN sb.Status = 'Completed' THEN 1 END) / COUNT(sb.SessionID)) * 100, 2)
        ELSE 0.00
    END AS CompletionRate,
    IFNULL(SUM(sb.Price), 0.00) AS TotalRevenue,
    ROUND(IFNULL(AVG(sb.Price), 0.00),2) AS AverageSessionPrice
FROM Users u
JOIN Trainers t ON u.UserID = t.TrainerID
LEFT JOIN SessionBooking sb ON t.TrainerID = sb.TrainerID AND sb.IsDeleted = 0
WHERE u.UserType = 'Trainer' AND u.IsDeleted = 0 AND t.IsDeleted = 0
GROUP BY u.UserID, u.FirstName, u.LastName, u.Email, t.Rate
ORDER BY TotalRevenue DESC;

-- Report 03: Revenue Trends Over Time
SELECT 
    DATE_FORMAT(sb.SessionDate, '%Y-%m') AS YearMonth,
    COUNT(sb.SessionID) AS TotalSessions,
    IFNULL(SUM(sb.Price), 0.00) AS TotalRevenue,
    ROUND(IFNULL(AVG(sb.Price), 0.00), 2) AS AverageSessionPrice
FROM SessionBooking sb
WHERE sb.IsDeleted = 0
GROUP BY DATE_FORMAT(sb.SessionDate, '%Y-%m')
ORDER BY YearMonth DESC;

-- Report 04: Client Activity Report
SELECT u.UserID AS ClientID, CONCAT(u.FirstName, ' ', u.LastName) AS ClientName,
    u.Email AS ClientEmail, c.JoinDate,
    COUNT(sb.SessionID) AS TotalSessionsBooked,
    COALESCE(SUM(sb.Price), 0.00) AS TotalAmountSpent,
    COALESCE(AVG(sb.Price), 0.00) AS AverageSessionPrice,
    MAX(sb.BookingDate) AS MostRecentBookingDate
FROM Users u
JOIN Clients c ON u.UserID = c.ClientID
LEFT JOIN SessionBooking sb ON c.ClientID = sb.ClientID AND sb.IsDeleted = 0
WHERE u.UserType = 'Client' AND u.IsDeleted = 0 AND c.IsDeleted = 0
GROUP BY u.UserID, u.FirstName, u.LastName, u.Email, c.JoinDate
ORDER BY TotalAmountSpent DESC;

-- Report 05: Room Utilization Report
SELECT r.RoomID, r.RoomNo,r.RoomName,
    COUNT(sb.SessionID) AS TotalSessionsAssigned,
    COUNT(sb.SessionID) AS TotalHoursUtilized,
    IFNULL(SUM(sb.Price), 0.00) AS RevenueGenerated
FROM Rooms r
LEFT JOIN SessionBooking sb ON r.RoomID = sb.RoomID AND sb.IsDeleted = 0
WHERE r.IsDeleted = 0
GROUP BY r.RoomID, r.RoomNo, r.RoomName
ORDER BY TotalSessionsAssigned DESC;

-- Report 06: Booking Status Breakdown
SELECT sb.Status, COUNT(sb.SessionID) AS SessionCount,
    IFNULL(SUM(sb.Price), 0.00) AS TotalRevenue,
    ROUND((COUNT(sb.SessionID) / (SELECT COUNT(*) FROM SessionBooking WHERE IsDeleted = 0)) * 100, 2) AS PercentageOfTotalSessions,
    ROUND((IFNULL(SUM(sb.Price), 0.00) / NULLIF((SELECT IFNULL(SUM(Price), 0.00) FROM SessionBooking WHERE IsDeleted = 0), 0)) * 100, 2) AS PercentageOfTotalRevenue
FROM SessionBooking sb
WHERE sb.IsDeleted = 0
GROUP BY sb.Status
ORDER BY sb.Status;

-- Report 07: Payment Status Analysis
SELECT p.Status AS PaymentStatus, COUNT(p.PaymentID) AS PaymentCount,
    IFNULL(SUM(p.Amount), 0.00) AS TotalAmount, ROUND(IFNULL(AVG(p.Amount), 0.00), 2) AS AveragePaymentAmount,
    ROUND((COUNT(p.PaymentID) / NULLIF((SELECT COUNT(*) FROM Payments WHERE IsDeleted = 0), 0)) * 100, 2) AS PercentageOfTotalPayments,
    ROUND((IFNULL(SUM(p.Amount), 0.00) / NULLIF((SELECT COALESCE(SUM(Amount), 0.00) FROM Payments WHERE IsDeleted = 0), 0)) * 100, 2) AS PercentageOfTotalRevenue
FROM Payments p
WHERE p.IsDeleted = 0
GROUP BY p.Status
ORDER BY PaymentStatus;

-- Report 09: Trainer Availability vs Bookings (Utilization)
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
    IFNULL(SUM(sb.Price), 0.00) AS RevenueGenerated
FROM Users u
JOIN Trainers t ON u.UserID = t.TrainerID
LEFT JOIN TrainerAvailability ta ON t.TrainerID = ta.TrainerID AND ta.IsDeleted = 0
LEFT JOIN SessionBooking sb ON t.TrainerID = sb.TrainerID AND sb.IsDeleted = 0
WHERE u.UserType = 'Trainer' AND u.IsDeleted = 0 AND t.IsDeleted = 0
GROUP BY u.UserID, u.FirstName, u.LastName
ORDER BY UtilizationRate DESC;

-- Report 10: Session Completion Analysis
-- Overall completion and cancellation rates
SELECT 
    'Overall' AS Category,
    'All Sessions' AS SubCategory,
    COUNT(sb.SessionID) AS TotalSessions,
    COUNT(CASE WHEN sb.Status = 'Completed' THEN 1 END) AS CompletedSessions,
    COUNT(CASE WHEN sb.Status = 'Cancelled' THEN 1 END) AS CancelledSessions,
    ROUND((COUNT(CASE WHEN sb.Status = 'Completed' THEN 1 END) / NULLIF(COUNT(sb.SessionID), 0)) * 100, 2) AS CompletionRate,
    ROUND((COUNT(CASE WHEN sb.Status = 'Cancelled' THEN 1 END) / NULLIF(COUNT(sb.SessionID), 0)) * 100, 2) AS CancellationRate,
    IFNULL(SUM(CASE WHEN sb.Status = 'Cancelled' THEN sb.Price ELSE 0 END), 0.00) AS RevenueLostFromCancellations
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
    IFNULL(SUM(CASE WHEN sb.Status = 'Cancelled' THEN sb.Price ELSE 0 END), 0.00) AS RevenueLostFromCancellations
FROM SessionBooking sb
JOIN Specialties s ON sb.SpecialtyID = s.SpecialtyID
WHERE sb.IsDeleted = 0 AND s.IsDeleted = 0
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
    IFNULL(SUM(CASE WHEN sb.Status = 'Cancelled' THEN sb.Price ELSE 0 END), 0.00) AS RevenueLostFromCancellations
FROM SessionBooking sb JOIN Trainers t ON sb.TrainerID = t.TrainerID
JOIN Users u ON t.TrainerID = u.UserID
WHERE sb.IsDeleted = 0 AND t.IsDeleted = 0 AND u.IsDeleted = 0
GROUP BY u.UserID, u.FirstName, u.LastName
ORDER BY Category, CompletionRate DESC;