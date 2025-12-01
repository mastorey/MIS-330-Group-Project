-- ============================================================================
-- Report 07: Payment Status Analysis
-- ============================================================================
-- Description: Analyzes payment status (Pending, Completed, Failed) including
--              count of payments, total amount, percentages, and average payment
--              amount per status.
-- ============================================================================

SELECT 
    p.Status AS PaymentStatus,
    COUNT(p.PaymentID) AS PaymentCount,
    COALESCE(SUM(p.Amount), 0.00) AS TotalAmount,
    COALESCE(AVG(p.Amount), 0.00) AS AveragePaymentAmount,
    ROUND((COUNT(p.PaymentID) / NULLIF((SELECT COUNT(*) FROM Payments WHERE IsDeleted = 0), 0)) * 100, 2) AS PercentageOfTotalPayments,
    ROUND((COALESCE(SUM(p.Amount), 0.00) / NULLIF((SELECT COALESCE(SUM(Amount), 0.00) FROM Payments WHERE IsDeleted = 0), 0)) * 100, 2) AS PercentageOfTotalRevenue
FROM Payments p
WHERE p.IsDeleted = 0
GROUP BY p.Status

UNION ALL

SELECT 
    'No Payment' AS PaymentStatus,
    COUNT(sb.SessionID) AS PaymentCount,
    0.00 AS TotalAmount,
    0.00 AS AveragePaymentAmount,
    ROUND((COUNT(sb.SessionID) / NULLIF((SELECT COUNT(*) FROM SessionBooking WHERE IsDeleted = 0), 0)) * 100, 2) AS PercentageOfTotalPayments,
    0.00 AS PercentageOfTotalRevenue
FROM SessionBooking sb
LEFT JOIN Payments p ON sb.SessionID = p.SessionID AND p.IsDeleted = 0
WHERE sb.IsDeleted = 0
    AND p.PaymentID IS NULL

ORDER BY PaymentStatus;

