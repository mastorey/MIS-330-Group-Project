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
                
                // Query unassigned sessions (where RoomID IS NULL)
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

