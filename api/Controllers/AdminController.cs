using Microsoft.AspNetCore.Mvc;
using MySql.Data.MySqlClient;

namespace MyApp.Namespace
{
    [Route("api/admin")]
    [ApiController]
    public class AdminController : ControllerBase
    {
        private readonly DatabaseUtility _dbUtility;

        public AdminController(DatabaseUtility dbUtility)
        {
            _dbUtility = dbUtility;
        }

        [HttpGet("unassigned-sessions")]
        public IActionResult GetUnassignedSessions([FromQuery] string email)
        {
            if (string.IsNullOrEmpty(email))
            {
                return BadRequest(new
                {
                    success = false,
                    message = "Email is required"
                });
            }

            // Verify user is admin
            if (!IsAdmin(email))
            {
                return Forbid("Only admins can access this endpoint");
            }

            try
            {
                using var connection = _dbUtility.GetConnection();
                
                // Query unassigned sessions (where RoomID IS NULL and Status is not Cancelled)
                string query = @"
                    SELECT 
                        sb.SessionID,
                        sb.SessionDate,
                        sb.StartTime,
                        CONCAT(ut.FirstName, ' ', ut.LastName) AS TrainerName,
                        CONCAT(uc.FirstName, ' ', uc.LastName) AS ClientName,
                        s.SpecialtyName,
                        sb.SpecialtyID,
                        sb.Status,
                        sb.Price
                    FROM SessionBooking sb
                    INNER JOIN Trainers t ON sb.TrainerID = t.TrainerID
                    INNER JOIN Users ut ON t.TrainerID = ut.UserID
                    INNER JOIN Clients c ON sb.ClientID = c.ClientID
                    INNER JOIN Users uc ON c.ClientID = uc.UserID
                    INNER JOIN Specialties s ON sb.SpecialtyID = s.SpecialtyID
                    WHERE sb.RoomID IS NULL
                    AND sb.Status != 'Cancelled'
                    AND sb.IsDeleted = 0
                    AND t.IsDeleted = 0
                    AND c.IsDeleted = 0
                    AND s.IsDeleted = 0
                    ORDER BY sb.SessionDate ASC, sb.StartTime ASC";

                using var command = new MySqlCommand(query, connection);
                using var reader = command.ExecuteReader();
                var sessionsList = new List<object>();

                while (reader.Read())
                {
                    var session = new
                    {
                        sessionId = reader.GetInt32("SessionID"),
                        sessionDate = reader.GetDateTime("SessionDate").ToString("yyyy-MM-dd"),
                        startTime = reader.GetTimeSpan("StartTime").ToString(@"hh\:mm"),
                        trainerName = reader.GetString("TrainerName"),
                        clientName = reader.GetString("ClientName"),
                        specialtyName = reader.GetString("SpecialtyName"),
                        specialtyId = reader.GetInt32("SpecialtyID"),
                        status = reader.GetString("Status"),
                        price = reader.IsDBNull(reader.GetOrdinal("Price")) ? 0.00m : reader.GetDecimal("Price")
                    };
                    sessionsList.Add(session);
                }

                return Ok(new
                {
                    success = true,
                    data = sessionsList
                });
            }
            catch (MySqlException ex)
            {
                return StatusCode(500, new
                {
                    success = false,
                    message = "Database error occurred",
                    error = ex.Message
                });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new
                {
                    success = false,
                    message = "An error occurred while fetching unassigned sessions",
                    error = ex.Message
                });
            }
        }

        [HttpGet("today-sessions")]
        public IActionResult GetTodaySessions([FromQuery] string email)
        {
            if (string.IsNullOrEmpty(email))
            {
                return BadRequest(new
                {
                    success = false,
                    message = "Email is required"
                });
            }

            // Verify user is admin
            if (!IsAdmin(email))
            {
                return Forbid("Only admins can access this endpoint");
            }

            try
            {
                using var connection = _dbUtility.GetConnection();
                
                // Query today's sessions ordered by StartTime
                string query = @"
                    SELECT 
                        sb.SessionID,
                        sb.TrainerID,
                        sb.ClientID,
                        sb.SessionDate,
                        sb.StartTime,
                        CONCAT(ut.FirstName, ' ', ut.LastName) AS TrainerName,
                        CONCAT(uc.FirstName, ' ', uc.LastName) AS ClientName,
                        s.SpecialtyName,
                        sb.SpecialtyID,
                        r.RoomName,
                        sb.RoomID,
                        sb.Status,
                        sb.Price
                    FROM SessionBooking sb
                    INNER JOIN Trainers t ON sb.TrainerID = t.TrainerID
                    INNER JOIN Users ut ON t.TrainerID = ut.UserID
                    INNER JOIN Clients c ON sb.ClientID = c.ClientID
                    INNER JOIN Users uc ON c.ClientID = uc.UserID
                    INNER JOIN Specialties s ON sb.SpecialtyID = s.SpecialtyID
                    LEFT JOIN Rooms r ON sb.RoomID = r.RoomID
                    WHERE sb.SessionDate = CURDATE()
                    AND sb.Status != 'Cancelled'
                    AND sb.IsDeleted = 0
                    AND t.IsDeleted = 0
                    AND c.IsDeleted = 0
                    AND ut.IsDeleted = 0
                    AND uc.IsDeleted = 0
                    AND s.IsDeleted = 0
                    ORDER BY sb.StartTime ASC";

                using var command = new MySqlCommand(query, connection);
                using var reader = command.ExecuteReader();
                var sessionsList = new List<object>();

                while (reader.Read())
                {
                    var session = new
                    {
                        sessionId = reader.GetInt32("SessionID"),
                        trainerId = reader.GetInt32("TrainerID"),
                        clientId = reader.GetInt32("ClientID"),
                        sessionDate = reader.GetDateTime("SessionDate").ToString("yyyy-MM-dd"),
                        startTime = reader.GetTimeSpan("StartTime").ToString(@"hh\:mm"),
                        trainerName = reader.GetString("TrainerName"),
                        clientName = reader.GetString("ClientName"),
                        specialtyName = reader.GetString("SpecialtyName"),
                        specialtyId = reader.GetInt32("SpecialtyID"),
                        roomName = reader.IsDBNull(reader.GetOrdinal("RoomName")) ? null : reader.GetString("RoomName"),
                        roomId = reader.IsDBNull(reader.GetOrdinal("RoomID")) ? (int?)null : reader.GetInt32("RoomID"),
                        status = reader.GetString("Status"),
                        price = reader.IsDBNull(reader.GetOrdinal("Price")) ? 0.00m : reader.GetDecimal("Price")
                    };
                    sessionsList.Add(session);
                }

                return Ok(new
                {
                    success = true,
                    data = sessionsList
                });
            }
            catch (MySqlException ex)
            {
                return StatusCode(500, new
                {
                    success = false,
                    message = "Database error occurred",
                    error = ex.Message
                });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new
                {
                    success = false,
                    message = "An error occurred while fetching today's sessions",
                    error = ex.Message
                });
            }
        }

        [HttpGet("all-sessions")]
        public IActionResult GetAllSessions([FromQuery] string email)
        {
            if (string.IsNullOrEmpty(email))
            {
                return BadRequest(new
                {
                    success = false,
                    message = "Email is required"
                });
            }

            // Verify user is admin
            if (!IsAdmin(email))
            {
                return Forbid("Only admins can access this endpoint");
            }

            try
            {
                using var connection = _dbUtility.GetConnection();
                
                // Query all sessions with full details
                string query = @"
                    SELECT 
                        sb.SessionID,
                        sb.SessionDate,
                        sb.StartTime,
                        CONCAT(ut.FirstName, ' ', ut.LastName) AS TrainerName,
                        CONCAT(uc.FirstName, ' ', uc.LastName) AS ClientName,
                        s.SpecialtyName,
                        sb.SpecialtyID,
                        r.RoomName,
                        sb.RoomID,
                        sb.Status,
                        sb.Price,
                        COALESCE(p.Status, 'Pending') AS PaymentStatus,
                        sb.BookingDate
                    FROM SessionBooking sb
                    INNER JOIN Trainers t ON sb.TrainerID = t.TrainerID
                    INNER JOIN Users ut ON t.TrainerID = ut.UserID
                    INNER JOIN Clients c ON sb.ClientID = c.ClientID
                    INNER JOIN Users uc ON c.ClientID = uc.UserID
                    INNER JOIN Specialties s ON sb.SpecialtyID = s.SpecialtyID
                    LEFT JOIN Rooms r ON sb.RoomID = r.RoomID
                    LEFT JOIN Payments p ON sb.SessionID = p.SessionID AND p.IsDeleted = 0
                    WHERE sb.IsDeleted = 0
                    AND t.IsDeleted = 0
                    AND c.IsDeleted = 0
                    AND ut.IsDeleted = 0
                    AND uc.IsDeleted = 0
                    AND s.IsDeleted = 0
                    ORDER BY sb.SessionDate ASC, sb.StartTime ASC";

                using var command = new MySqlCommand(query, connection);
                using var reader = command.ExecuteReader();
                var sessionsList = new List<object>();

                while (reader.Read())
                {
                    var session = new
                    {
                        sessionId = reader.GetInt32("SessionID"),
                        sessionDate = reader.GetDateTime("SessionDate").ToString("yyyy-MM-dd"),
                        startTime = reader.GetTimeSpan("StartTime").ToString(@"hh\:mm"),
                        trainerName = reader.GetString("TrainerName"),
                        clientName = reader.GetString("ClientName"),
                        specialtyName = reader.GetString("SpecialtyName"),
                        specialtyId = reader.GetInt32("SpecialtyID"),
                        roomName = reader.IsDBNull(reader.GetOrdinal("RoomName")) ? null : reader.GetString("RoomName"),
                        roomId = reader.IsDBNull(reader.GetOrdinal("RoomID")) ? (int?)null : reader.GetInt32("RoomID"),
                        status = reader.GetString("Status"),
                        price = reader.IsDBNull(reader.GetOrdinal("Price")) ? 0.00m : reader.GetDecimal("Price"),
                        paymentStatus = reader.GetString("PaymentStatus"),
                        bookingDate = reader.IsDBNull(reader.GetOrdinal("BookingDate")) ? null : reader.GetDateTime("BookingDate").ToString("yyyy-MM-dd HH:mm:ss")
                    };
                    sessionsList.Add(session);
                }

                return Ok(new
                {
                    success = true,
                    data = sessionsList
                });
            }
            catch (MySqlException ex)
            {
                return StatusCode(500, new
                {
                    success = false,
                    message = "Database error occurred",
                    error = ex.Message
                });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new
                {
                    success = false,
                    message = "An error occurred while fetching all sessions",
                    error = ex.Message
                });
            }
        }

        [HttpGet("available-rooms")]
        public IActionResult GetAvailableRooms([FromQuery] string email, [FromQuery] string sessionDate, [FromQuery] string startTime, [FromQuery] int specialtyId)
        {
            if (string.IsNullOrEmpty(email))
            {
                return BadRequest(new
                {
                    success = false,
                    message = "Email is required"
                });
            }

            if (string.IsNullOrEmpty(sessionDate) || string.IsNullOrEmpty(startTime) || specialtyId <= 0)
            {
                return BadRequest(new
                {
                    success = false,
                    message = "SessionDate, StartTime, and SpecialtyId are required"
                });
            }

            // Verify user is admin
            if (!IsAdmin(email))
            {
                return Forbid("Only admins can access this endpoint");
            }

            try
            {
                using var connection = _dbUtility.GetConnection();
                
                // Parse date and time
                if (!DateTime.TryParse(sessionDate, out DateTime parsedDate))
                {
                    return BadRequest(new
                    {
                        success = false,
                        message = "Invalid session date format"
                    });
                }

                if (!TimeSpan.TryParse(startTime, out TimeSpan parsedTime))
                {
                    return BadRequest(new
                    {
                        success = false,
                        message = "Invalid start time format"
                    });
                }

                // Query available rooms:
                // 1. Rooms that support the specialty (via RoomSpecialties)
                // 2. Rooms not already booked for that date/time
                // 3. Sessions are 1 hour, so check for time overlaps
                // Time conflict: sessions overlap if one starts before the other ends
                string query = @"
                    SELECT DISTINCT
                        r.RoomID,
                        r.RoomNo,
                        r.RoomName
                    FROM Rooms r
                    INNER JOIN RoomSpecialties rs ON r.RoomID = rs.RoomID
                    WHERE rs.SpecialtyID = @specialtyId
                    AND rs.IsDeleted = 0
                    AND r.IsDeleted = 0
                    AND r.RoomID NOT IN (
                        SELECT DISTINCT sb.RoomID
                        FROM SessionBooking sb
                        WHERE sb.SessionDate = @sessionDate
                        AND sb.RoomID IS NOT NULL
                        AND sb.IsDeleted = 0
                        AND (
                            (sb.StartTime < ADDTIME(@startTime, '01:00:00') AND ADDTIME(sb.StartTime, '01:00:00') > @startTime)
                        )
                    )
                    ORDER BY r.RoomName ASC";

                using var command = new MySqlCommand(query, connection);
                command.Parameters.AddWithValue("@specialtyId", specialtyId);
                command.Parameters.AddWithValue("@sessionDate", parsedDate);
                command.Parameters.AddWithValue("@startTime", parsedTime);

                using var reader = command.ExecuteReader();
                var roomsList = new List<object>();

                while (reader.Read())
                {
                    var room = new
                    {
                        roomId = reader.GetInt32("RoomID"),
                        roomNo = reader.GetString("RoomNo"),
                        roomName = reader.GetString("RoomName")
                    };
                    roomsList.Add(room);
                }

                return Ok(new
                {
                    success = true,
                    data = roomsList
                });
            }
            catch (MySqlException ex)
            {
                return StatusCode(500, new
                {
                    success = false,
                    message = "Database error occurred",
                    error = ex.Message
                });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new
                {
                    success = false,
                    message = "An error occurred while fetching available rooms",
                    error = ex.Message
                });
            }
        }

        [HttpPut("assign-room")]
        public IActionResult AssignRoom([FromBody] AssignRoomRequest request, [FromQuery] string email)
        {
            if (string.IsNullOrEmpty(email))
            {
                return BadRequest(new
                {
                    success = false,
                    message = "Email is required"
                });
            }

            if (request.SessionId <= 0 || request.RoomId <= 0)
            {
                return BadRequest(new
                {
                    success = false,
                    message = "SessionId and RoomId are required"
                });
            }

            // Verify user is admin
            if (!IsAdmin(email))
            {
                return Forbid("Only admins can access this endpoint");
            }

            try
            {
                using var connection = _dbUtility.GetConnection();
                
                // Get session details
                string getSessionQuery = @"
                    SELECT SessionDate, StartTime, SpecialtyID, RoomID
                    FROM SessionBooking
                    WHERE SessionID = @sessionId
                    AND IsDeleted = 0";

                DateTime sessionDate;
                TimeSpan startTime;
                int specialtyId;
                int? currentRoomId = null;

                using (var getSessionCommand = new MySqlCommand(getSessionQuery, connection))
                {
                    getSessionCommand.Parameters.AddWithValue("@sessionId", request.SessionId);
                    using var sessionReader = getSessionCommand.ExecuteReader();
                    
                    if (!sessionReader.Read())
                    {
                        return NotFound(new
                        {
                            success = false,
                            message = "Session not found"
                        });
                    }

                    sessionDate = sessionReader.GetDateTime("SessionDate");
                    startTime = sessionReader.GetTimeSpan("StartTime");
                    specialtyId = sessionReader.GetInt32("SpecialtyID");
                    if (!sessionReader.IsDBNull(sessionReader.GetOrdinal("RoomID")))
                    {
                        currentRoomId = sessionReader.GetInt32("RoomID");
                    }
                }

                // Verify room supports the specialty
                string checkSpecialtyQuery = @"
                    SELECT COUNT(*) 
                    FROM RoomSpecialties 
                    WHERE RoomID = @roomId 
                    AND SpecialtyID = @specialtyId 
                    AND IsDeleted = 0";

                using (var checkCommand = new MySqlCommand(checkSpecialtyQuery, connection))
                {
                    checkCommand.Parameters.AddWithValue("@roomId", request.RoomId);
                    checkCommand.Parameters.AddWithValue("@specialtyId", specialtyId);
                    var count = Convert.ToInt32(checkCommand.ExecuteScalar());
                    
                    if (count == 0)
                    {
                        return BadRequest(new
                        {
                            success = false,
                            message = "Room does not support this session's specialty"
                        });
                    }
                }

                // Verify room is available at that time
                // Time conflict: sessions overlap if one starts before the other ends
                string checkAvailabilityQuery = @"
                    SELECT COUNT(*) 
                    FROM SessionBooking 
                    WHERE RoomID = @roomId
                    AND SessionDate = @sessionDate
                    AND SessionID != @sessionId
                    AND IsDeleted = 0
                    AND (
                        StartTime < ADDTIME(@startTime, '01:00:00') AND ADDTIME(StartTime, '01:00:00') > @startTime
                    )";

                using (var checkAvailCommand = new MySqlCommand(checkAvailabilityQuery, connection))
                {
                    checkAvailCommand.Parameters.AddWithValue("@roomId", request.RoomId);
                    checkAvailCommand.Parameters.AddWithValue("@sessionDate", sessionDate);
                    checkAvailCommand.Parameters.AddWithValue("@sessionId", request.SessionId);
                    checkAvailCommand.Parameters.AddWithValue("@startTime", startTime);
                    var conflictCount = Convert.ToInt32(checkAvailCommand.ExecuteScalar());
                    
                    if (conflictCount > 0)
                    {
                        return BadRequest(new
                        {
                            success = false,
                            message = "Room is not available at this time"
                        });
                    }
                }

                // Assign room to session and set status to Confirmed
                string updateQuery = @"
                    UPDATE SessionBooking 
                    SET RoomID = @roomId, Status = 'Confirmed'
                    WHERE SessionID = @sessionId";

                using var updateCommand = new MySqlCommand(updateQuery, connection);
                updateCommand.Parameters.AddWithValue("@roomId", request.RoomId);
                updateCommand.Parameters.AddWithValue("@sessionId", request.SessionId);

                int rowsAffected = updateCommand.ExecuteNonQuery();

                if (rowsAffected == 0)
                {
                    return StatusCode(500, new
                    {
                        success = false,
                        message = "Failed to assign room"
                    });
                }

                return Ok(new
                {
                    success = true,
                    message = "Room assigned successfully"
                });
            }
            catch (MySqlException ex)
            {
                return StatusCode(500, new
                {
                    success = false,
                    message = "Database error occurred",
                    error = ex.Message
                });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new
                {
                    success = false,
                    message = "An error occurred while assigning room",
                    error = ex.Message
                });
            }
        }

        [HttpPut("sessions/{id}/complete")]
        public IActionResult CompleteSession(int id, [FromQuery] string email)
        {
            if (string.IsNullOrEmpty(email))
            {
                return BadRequest(new
                {
                    success = false,
                    message = "Email is required"
                });
            }

            // Verify user is admin
            if (!IsAdmin(email))
            {
                return Forbid("Only admins can access this endpoint");
            }

            try
            {
                using var connection = _dbUtility.GetConnection();
                
                // Check if session exists
                string checkSessionQuery = @"
                    SELECT SessionID, Status
                    FROM SessionBooking
                    WHERE SessionID = @sessionId
                    AND IsDeleted = 0";

                string currentStatus = null;
                using (var checkCommand = new MySqlCommand(checkSessionQuery, connection))
                {
                    checkCommand.Parameters.AddWithValue("@sessionId", id);
                    using var reader = checkCommand.ExecuteReader();
                    
                    if (!reader.Read())
                    {
                        return NotFound(new
                        {
                            success = false,
                            message = "Session not found"
                        });
                    }

                    currentStatus = reader.GetString("Status");
                }

                if (currentStatus == "Completed")
                {
                    return BadRequest(new
                    {
                        success = false,
                        message = "Session is already completed"
                    });
                }

                if (currentStatus == "Cancelled")
                {
                    return BadRequest(new
                    {
                        success = false,
                        message = "Cannot complete a cancelled session"
                    });
                }

                // Update session status to Completed
                string updateQuery = @"
                    UPDATE SessionBooking 
                    SET Status = 'Completed'
                    WHERE SessionID = @sessionId";

                using var updateCommand = new MySqlCommand(updateQuery, connection);
                updateCommand.Parameters.AddWithValue("@sessionId", id);

                int rowsAffected = updateCommand.ExecuteNonQuery();

                if (rowsAffected == 0)
                {
                    return StatusCode(500, new
                    {
                        success = false,
                        message = "Failed to complete session"
                    });
                }

                return Ok(new
                {
                    success = true,
                    message = "Session marked as completed successfully"
                });
            }
            catch (MySqlException ex)
            {
                return StatusCode(500, new
                {
                    success = false,
                    message = "Database error occurred",
                    error = ex.Message
                });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new
                {
                    success = false,
                    message = "An error occurred while completing session",
                    error = ex.Message
                });
            }
        }

        [HttpPut("unassign-room")]
        public IActionResult UnassignRoom([FromBody] UnassignRoomRequest request, [FromQuery] string email)
        {
            if (string.IsNullOrEmpty(email))
            {
                return BadRequest(new
                {
                    success = false,
                    message = "Email is required"
                });
            }

            if (request.SessionId <= 0)
            {
                return BadRequest(new
                {
                    success = false,
                    message = "SessionId is required"
                });
            }

            // Verify user is admin
            if (!IsAdmin(email))
            {
                return Forbid("Only admins can access this endpoint");
            }

            try
            {
                using var connection = _dbUtility.GetConnection();
                
                // Check if session exists
                string checkSessionQuery = @"
                    SELECT SessionID, RoomID
                    FROM SessionBooking
                    WHERE SessionID = @sessionId
                    AND IsDeleted = 0";

                bool hasRoom = false;
                using (var checkCommand = new MySqlCommand(checkSessionQuery, connection))
                {
                    checkCommand.Parameters.AddWithValue("@sessionId", request.SessionId);
                    using var reader = checkCommand.ExecuteReader();
                    
                    if (!reader.Read())
                    {
                        return NotFound(new
                        {
                            success = false,
                            message = "Session not found"
                        });
                    }

                    hasRoom = !reader.IsDBNull(reader.GetOrdinal("RoomID"));
                }

                if (!hasRoom)
                {
                    return BadRequest(new
                    {
                        success = false,
                        message = "Session does not have a room assigned"
                    });
                }

                // Unassign room (set RoomID to NULL) and set status back to Pending
                string updateQuery = @"
                    UPDATE SessionBooking 
                    SET RoomID = NULL, Status = 'Pending'
                    WHERE SessionID = @sessionId";

                using var updateCommand = new MySqlCommand(updateQuery, connection);
                updateCommand.Parameters.AddWithValue("@sessionId", request.SessionId);

                int rowsAffected = updateCommand.ExecuteNonQuery();

                if (rowsAffected == 0)
                {
                    return StatusCode(500, new
                    {
                        success = false,
                        message = "Failed to unassign room"
                    });
                }

                return Ok(new
                {
                    success = true,
                    message = "Room unassigned successfully. Session is now available for room assignment."
                });
            }
            catch (MySqlException ex)
            {
                return StatusCode(500, new
                {
                    success = false,
                    message = "Database error occurred",
                    error = ex.Message
                });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new
                {
                    success = false,
                    message = "An error occurred while unassigning room",
                    error = ex.Message
                });
            }
        }

        [HttpGet("reports/specialty-performance")]
        public IActionResult GetSpecialtyPerformanceReport([FromQuery] string email)
        {
            if (string.IsNullOrEmpty(email) || !IsAdmin(email))
            {
                return Forbid("Only admins can access this endpoint");
            }

            try
            {
                using var connection = _dbUtility.GetConnection();
                string query = @"
                    SELECT s.SpecialtyID, s.SpecialtyName,
                        IF(COUNT(sb.SessionID) > 0, 'Yes', 'No') AS HasBookings,
                        COUNT(sb.SessionID) AS TotalSessionsBooked,
                        IFNULL(SUM(sb.Price), 0.00) AS TotalRevenue,
                        ROUND(IFNULL(AVG(sb.Price), 0.00), 2) AS AverageSessionPrice
                    FROM Specialties s
                    LEFT JOIN SessionBooking sb ON s.SpecialtyID = sb.SpecialtyID AND sb.IsDeleted = 0
                    WHERE s.IsDeleted = 0
                    GROUP BY s.SpecialtyID, s.SpecialtyName
                    ORDER BY TotalRevenue DESC";

                var result = ExecuteReportQuery(connection, query, "Specialty Performance");
                return result;
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { success = false, message = ex.Message });
            }
        }

        [HttpGet("reports/trainer-performance")]
        public IActionResult GetTrainerPerformanceReport([FromQuery] string email)
        {
            if (string.IsNullOrEmpty(email) || !IsAdmin(email))
            {
                return Forbid("Only admins can access this endpoint");
            }

            try
            {
                using var connection = _dbUtility.GetConnection();
                string query = @"
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
                    ORDER BY TotalRevenue DESC";

                return ExecuteReportQuery(connection, query, "Trainer Performance");
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { success = false, message = ex.Message });
            }
        }

        [HttpGet("reports/revenue-trends")]
        public IActionResult GetRevenueTrendsReport([FromQuery] string email)
        {
            if (string.IsNullOrEmpty(email) || !IsAdmin(email))
            {
                return Forbid("Only admins can access this endpoint");
            }

            try
            {
                using var connection = _dbUtility.GetConnection();
                string query = @"
                    SELECT 
                        DATE_FORMAT(sb.SessionDate, '%Y-%m') AS YearMonth,
                        COUNT(sb.SessionID) AS TotalSessions,
                        IFNULL(SUM(sb.Price), 0.00) AS TotalRevenue,
                        ROUND(IFNULL(AVG(sb.Price), 0.00), 2) AS AverageSessionPrice
                    FROM SessionBooking sb
                    WHERE sb.IsDeleted = 0
                    GROUP BY DATE_FORMAT(sb.SessionDate, '%Y-%m')
                    ORDER BY YearMonth DESC";

                var result = ExecuteReportQuery(connection, query, "Revenue Trends");
                return result;
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { success = false, message = ex.Message });
            }
        }

        [HttpGet("reports/client-activity")]
        public IActionResult GetClientActivityReport([FromQuery] string email)
        {
            if (string.IsNullOrEmpty(email) || !IsAdmin(email))
            {
                return Forbid("Only admins can access this endpoint");
            }

            try
            {
                using var connection = _dbUtility.GetConnection();
                string query = @"
                    SELECT u.UserID AS ClientID, CONCAT(u.FirstName, ' ', u.LastName) AS ClientName,
                        u.Email AS ClientEmail, DATE_FORMAT(c.JoinDate, '%Y-%m-%d') AS JoinDate,
                        COUNT(sb.SessionID) AS TotalSessionsBooked,
                        COALESCE(SUM(sb.Price), 0.00) AS TotalAmountSpent,
                        COALESCE(AVG(sb.Price), 0.00) AS AverageSessionPrice,
                        MAX(sb.BookingDate) AS MostRecentBookingDate
                    FROM Users u
                    JOIN Clients c ON u.UserID = c.ClientID
                    LEFT JOIN SessionBooking sb ON c.ClientID = sb.ClientID AND sb.IsDeleted = 0
                    WHERE u.UserType = 'Client' AND u.IsDeleted = 0 AND c.IsDeleted = 0
                    GROUP BY u.UserID, u.FirstName, u.LastName, u.Email, c.JoinDate
                    ORDER BY TotalAmountSpent DESC";

                var result = ExecuteReportQuery(connection, query, "Client Activity");
                return result;
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { success = false, message = ex.Message });
            }
        }

        [HttpGet("reports/room-utilization")]
        public IActionResult GetRoomUtilizationReport([FromQuery] string email)
        {
            if (string.IsNullOrEmpty(email) || !IsAdmin(email))
            {
                return Forbid("Only admins can access this endpoint");
            }

            try
            {
                using var connection = _dbUtility.GetConnection();
                // Note: Each session is 1 hour, so TotalHoursUtilized = TotalSessionsAssigned
                string query = @"
                    SELECT r.RoomID, r.RoomNo, r.RoomName,
                        COUNT(sb.SessionID) AS TotalSessionsAssigned,
                        COUNT(sb.SessionID) AS TotalHoursUtilized,
                        IFNULL(SUM(sb.Price), 0.00) AS RevenueGenerated
                    FROM Rooms r
                    LEFT JOIN SessionBooking sb ON r.RoomID = sb.RoomID AND sb.IsDeleted = 0
                    WHERE r.IsDeleted = 0
                    GROUP BY r.RoomID, r.RoomNo, r.RoomName
                    ORDER BY TotalSessionsAssigned DESC";

                return ExecuteReportQuery(connection, query, "Room Utilization");
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { success = false, message = ex.Message });
            }
        }

        [HttpGet("reports/booking-status")]
        public IActionResult GetBookingStatusReport([FromQuery] string email)
        {
            if (string.IsNullOrEmpty(email) || !IsAdmin(email))
            {
                return Forbid("Only admins can access this endpoint");
            }

            try
            {
                using var connection = _dbUtility.GetConnection();
                string query = @"
                    SELECT sb.Status, COUNT(sb.SessionID) AS SessionCount,
                        IFNULL(SUM(sb.Price), 0.00) AS TotalRevenue,
                        ROUND((COUNT(sb.SessionID) / (SELECT COUNT(*) FROM SessionBooking WHERE IsDeleted = 0)) * 100, 2) AS PercentageOfTotalSessions,
                        ROUND((IFNULL(SUM(sb.Price), 0.00) / NULLIF((SELECT IFNULL(SUM(Price), 0.00) FROM SessionBooking WHERE IsDeleted = 0), 0)) * 100, 2) AS PercentageOfTotalRevenue
                    FROM SessionBooking sb
                    WHERE sb.IsDeleted = 0
                    GROUP BY sb.Status
                    ORDER BY sb.Status";

                return ExecuteReportQuery(connection, query, "Booking Status");
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { success = false, message = ex.Message });
            }
        }

        [HttpGet("reports/payment-status")]
        public IActionResult GetPaymentStatusReport([FromQuery] string email)
        {
            if (string.IsNullOrEmpty(email) || !IsAdmin(email))
            {
                return Forbid("Only admins can access this endpoint");
            }

            try
            {
                using var connection = _dbUtility.GetConnection();
                string query = @"
                    SELECT p.Status AS PaymentStatus, COUNT(p.PaymentID) AS PaymentCount,
                        IFNULL(SUM(p.Amount), 0.00) AS TotalAmount, ROUND(IFNULL(AVG(p.Amount), 0.00), 2) AS AveragePaymentAmount,
                        ROUND((COUNT(p.PaymentID) / NULLIF((SELECT COUNT(*) FROM Payments WHERE IsDeleted = 0), 0)) * 100, 2) AS PercentageOfTotalPayments,
                        ROUND((COALESCE(SUM(p.Amount), 0.00) / NULLIF((SELECT COALESCE(SUM(Amount), 0.00) FROM Payments WHERE IsDeleted = 0), 0)) * 100, 2) AS PercentageOfTotalRevenue
                    FROM Payments p
                    WHERE p.IsDeleted = 0
                    GROUP BY p.Status
                    ORDER BY PaymentStatus";

                return ExecuteReportQuery(connection, query, "Payment Status");
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { success = false, message = ex.Message });
            }
        }

        [HttpGet("reports/trainer-utilization")]
        public IActionResult GetTrainerUtilizationReport([FromQuery] string email)
        {
            if (string.IsNullOrEmpty(email) || !IsAdmin(email))
            {
                return Forbid("Only admins can access this endpoint");
            }

            try
            {
                using var connection = _dbUtility.GetConnection();
                string query = @"
                    SELECT 
                        u.UserID AS TrainerID,
                        CONCAT(u.FirstName, ' ', u.LastName) AS TrainerName,
                        COUNT(DISTINCT ta.AvailabilityID) AS TotalAvailabilitySlots,
                        COUNT(CASE WHEN sb.SessionDate >= DATE_SUB(CURDATE(), INTERVAL 30 DAY) THEN sb.SessionID END) AS TotalBookedSessions,
                        CASE 
                            WHEN SUM(
                                GREATEST(0, FLOOR((30 + 
                                (CASE ta.DayOfWeek
                                    WHEN 'Monday' THEN 0
                                    WHEN 'Tuesday' THEN 1
                                    WHEN 'Wednesday' THEN 2
                                    WHEN 'Thursday' THEN 3
                                    WHEN 'Friday' THEN 4
                                    WHEN 'Saturday' THEN 5
                                    WHEN 'Sunday' THEN 6
                                END - WEEKDAY(DATE_SUB(CURDATE(), INTERVAL 30 DAY)) + 7) % 7) / 7))
                            ) > 0
                            THEN LEAST(100.00, ROUND(
                                (COUNT(CASE WHEN sb.SessionDate >= DATE_SUB(CURDATE(), INTERVAL 30 DAY) THEN sb.SessionID END) / 
                                NULLIF(SUM(
                                    GREATEST(0, FLOOR((30 + 
                                    (CASE ta.DayOfWeek
                                        WHEN 'Monday' THEN 0
                                        WHEN 'Tuesday' THEN 1
                                        WHEN 'Wednesday' THEN 2
                                        WHEN 'Thursday' THEN 3
                                        WHEN 'Friday' THEN 4
                                        WHEN 'Saturday' THEN 5
                                        WHEN 'Sunday' THEN 6
                                    END - WEEKDAY(DATE_SUB(CURDATE(), INTERVAL 30 DAY)) + 7) % 7) / 7))
                                ), 1)) * 100, 2))
                            ELSE 0.00
                        END AS UtilizationRate,
                        IFNULL(SUM(CASE WHEN sb.SessionDate >= DATE_SUB(CURDATE(), INTERVAL 30 DAY) THEN sb.Price ELSE 0 END), 0.00) AS RevenueGenerated
                    FROM Users u
                    JOIN Trainers t ON u.UserID = t.TrainerID
                    LEFT JOIN TrainerAvailability ta ON t.TrainerID = ta.TrainerID AND ta.IsDeleted = 0
                    LEFT JOIN SessionBooking sb ON t.TrainerID = sb.TrainerID 
                        AND sb.IsDeleted = 0
                        AND sb.SessionDate >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
                    WHERE u.UserType = 'Trainer' AND u.IsDeleted = 0 AND t.IsDeleted = 0
                    GROUP BY u.UserID, u.FirstName, u.LastName
                    ORDER BY UtilizationRate DESC";

                return ExecuteReportQuery(connection, query, "Trainer Utilization");
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { success = false, message = ex.Message });
            }
        }

        [HttpGet("reports/session-completion")]
        public IActionResult GetSessionCompletionReport([FromQuery] string email)
        {
            if (string.IsNullOrEmpty(email) || !IsAdmin(email))
            {
                return Forbid("Only admins can access this endpoint");
            }

            try
            {
                using var connection = _dbUtility.GetConnection();
                string query = @"
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
                    ORDER BY Category, CompletionRate DESC";

                return ExecuteReportQuery(connection, query, "Session Completion");
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { success = false, message = ex.Message });
            }
        }

        // Helper method to execute report queries and return formatted results
        private IActionResult ExecuteReportQuery(MySqlConnection connection, string query, string reportName)
        {
            try
            {
                using var command = new MySqlCommand(query, connection);
                using var reader = command.ExecuteReader();
                
                var reportData = new List<Dictionary<string, object>>();
                
                while (reader.Read())
                {
                    var row = new Dictionary<string, object>();
                    for (int i = 0; i < reader.FieldCount; i++)
                    {
                        string fieldName = reader.GetName(i);
                        object value = reader.IsDBNull(i) ? null : reader.GetValue(i);
                        row[fieldName] = value;
                    }
                    reportData.Add(row);
                }
                
                return Ok(new
                {
                    success = true,
                    reportName = reportName,
                    data = reportData
                });
            }
            catch (MySqlException ex)
            {
                return StatusCode(500, new
                {
                    success = false,
                    message = "Database error occurred",
                    error = ex.Message
                });
            }
        }

        // Helper method to check if user is admin
        private bool IsAdmin(string email)
        {
            try
            {
                using var connection = _dbUtility.GetConnection();
                string query = @"
                    SELECT COUNT(*) 
                    FROM Users u
                    INNER JOIN Admins a ON u.UserID = a.AdminID
                    WHERE u.Email = @email 
                    AND u.UserType = 'Admin'
                    AND u.IsDeleted = 0
                    AND a.IsDeleted = 0";

                using var command = new MySqlCommand(query, connection);
                command.Parameters.AddWithValue("@email", email.ToLower().Trim());
                var count = Convert.ToInt32(command.ExecuteScalar());
                return count > 0;
            }
            catch
            {
                return false;
            }
        }
    }

    public class AssignRoomRequest
    {
        public int SessionId { get; set; }
        public int RoomId { get; set; }
    }

    public class UnassignRoomRequest
    {
        public int SessionId { get; set; }
    }
}

