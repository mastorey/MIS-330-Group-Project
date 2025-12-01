-- ============================================================================
-- Report 08: Peak Booking Times
-- ============================================================================
-- Description: Identifies peak booking times by day of week and time slot,
--              including count of sessions, total revenue, and average session
--              price per day/time combination.
-- ============================================================================

SELECT 
    DAYNAME(sb.SessionDate) AS DayOfWeek,
    DAYOFWEEK(sb.SessionDate) AS DayOfWeekNumber,
    CASE 
        WHEN HOUR(sb.StartTime) BETWEEN 6 AND 11 THEN 'Morning (6AM-12PM)'
        WHEN HOUR(sb.StartTime) BETWEEN 12 AND 17 THEN 'Afternoon (12PM-6PM)'
        WHEN HOUR(sb.StartTime) BETWEEN 18 AND 21 THEN 'Evening (6PM-10PM)'
        ELSE 'Late Night (10PM-6AM)'
    END AS TimeSlot,
    HOUR(sb.StartTime) AS HourOfDay,
    COUNT(sb.SessionID) AS SessionCount,
    COALESCE(SUM(sb.Price), 0.00) AS TotalRevenue,
    COALESCE(AVG(sb.Price), 0.00) AS AverageSessionPrice
FROM SessionBooking sb
WHERE sb.IsDeleted = 0
GROUP BY DAYNAME(sb.SessionDate), 
         DAYOFWEEK(sb.SessionDate),
         CASE 
             WHEN HOUR(sb.StartTime) BETWEEN 6 AND 11 THEN 'Morning (6AM-12PM)'
             WHEN HOUR(sb.StartTime) BETWEEN 12 AND 17 THEN 'Afternoon (12PM-6PM)'
             WHEN HOUR(sb.StartTime) BETWEEN 18 AND 21 THEN 'Evening (6PM-10PM)'
             ELSE 'Late Night (10PM-6AM)'
         END,
         HOUR(sb.StartTime)
ORDER BY SessionCount DESC, DayOfWeekNumber, HourOfDay;

