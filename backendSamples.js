// Utility functions for date-based weekly grouping and aggregation

// Returns the Monday of the week for a given date
function getMondayOfWeek(date) {
	const tempDate = new Date(date);
	// Normalize time to midnight UTC for consistent comparisons
	tempDate.setUTCHours(0, 0, 0, 0);
	// Sunday is 0, so shift it to the previous Monday
	const dayOfWeek = tempDate.getUTCDay();
	const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
	tempDate.setUTCDate(tempDate.getUTCDate() + diff);

	return tempDate.toISOString().split('T')[0];
}

// Generates a list of Mondays (week start dates) within a date range
function generateWeeksInRange(startDate, endDate) {
	const weeks = [];
	let current = new Date(startDate);
	// Sunday is 0, so shift it to the previous Monday
	if (current.getUTCDay() !== 1) {
		// Add the current non-Monday date explicitly to the list
		weeks.unshift(current.toISOString().split('T')[0]);
		const monday = new Date(getMondayOfWeek(current));
		monday.setUTCDate(monday.getUTCDate() + 7);
		current = monday;
	}

	while (current < endDate) {
		weeks.push(current.toISOString().split('T')[0]);
		// Advance to the next Monday
		current.setUTCDate(current.getUTCDate() + 7);
	}

	return weeks;
}

// Counts occurrences of items grouped by week
function countByWeek(data, startDate) {
	const grouped = data.reduce((acc, item) => {
		// Normalize item.date to the Monday of that week
		const week = getMondayOfWeek(item.date);
		const start = new Date(startDate);

		// Handle edge case: group dates before startDate into the first week
		if (new Date(week) < start) {
			const firstWeek = start.toISOString().split('T')[0];
			acc[firstWeek] = (acc[firstWeek] || 0) + 1;
		} else {
			// Initialize count for week if not present
			acc[week] = (acc[week] || 0) + 1;
		}

		return acc;
	}, {});

	return grouped;
}

function mergeAndSumCounts(arr1, arr2, startDate, endDate, multiplier = 2) {
	// Count occurrences grouped by week in arr1, starting from startDate
	const weekCounts1 = countByWeek(arr1, startDate);

	// Count occurrences grouped by week in arr2, starting from startDate
	const weekCounts2 = countByWeek(arr2, startDate);

	// Generate an array of all weeks between startDate and endDate
	const allWeeks = generateWeeksInRange(new Date(startDate), new Date(endDate));

	// For each week in the range, create an object with:
	//  - x: the week label
	//  - y: sum of counts from arr1 and arr2 for that week,
	//       where arr2 counts are multiplied by the multiplier (default 2)
	return (
		allWeeks
			.map((week) => ({
				x: week,
				y: (weekCounts1[week] || 0) + (weekCounts2[week] || 0) * multiplier,
			}))
			// Filter the resulting array to remove leading and trailing weeks where y is zero
			.filter((_, index, array) => {
				// Find the index of the first week with a non-zero count
				const firstNonZeroIndex = array.findIndex((obj) => obj.y !== 0);

				// Find the index of the last week with a non-zero count
				let lastNonZeroIndex = -1;
				for (let i = array.length - 1; i >= 0; i--) {
					if (array[i].y !== 0) {
						lastNonZeroIndex = i;
						break;
					}
				}

				// Keep only the weeks between (and including) first and last non-zero counts
				return index >= firstNonZeroIndex && index <= lastNonZeroIndex;
			})
	);
}

function getLastSunday(date = new Date()) {
	const d = new Date(date);
	const day = d.getDay();
	d.setDate(d.getDate() - day);
	return d;
}

app.get('/api/club-data', async (req, res) => {
	const pool = req.pool;
	const user = req.user;
	const range = JSON.parse(decodeURIComponent(req.query.dateRange));
	const [start, end] = range;
	const startDate = start ? new Date(start) : new Date('2024-09-01');
	const endDate = end ? new Date(end) : getLastSunday();
	endDate.setUTCHours(23, 59, 59, 999);

	try {
		let queryPool = pool;
		let databases = ['placeholder'];
		const allData = [];

		if (user.dbName === 'director_dashboard') {
			const clubAccessQuery = await pool.query(
				`SELECT clubs FROM directors WHERE employee_id = $1`,
				[user.employee_id],
			);
			const clubAccessArray = clubAccessQuery.rows[0].clubs;

			const userMapPool = createPool('user_map');

			const databasesQuery = await userMapPool.query(
				`SELECT database, club_id FROM clubs WHERE club_id = ANY($1)`,
				[clubAccessArray],
			);
			databases = databasesQuery.rows;
		}

		for (const database of databases) {
			try {
				if (user.dbName === 'director_dashboard') {
					queryPool = createPool(database.database);
				}

				//Washroom Checks
				const oneWashroomChecksQuery = await queryPool.query(
					`SELECT date FROM washroom_checks 
            		WHERE ((mens_initials IS NOT NULL AND NOT womens_initials IS NOT NULL)
            		OR (womens_initials IS NOT NULL AND NOT mens_initials IS NOT NULL))
            		AND date >= ($1 AT TIME ZONE 'UTC') AND date <= ($2 AT TIME ZONE 'UTC')`,
					[startDate, endDate],
				);
				const oneWashroomChecks = oneWashroomChecksQuery.rows;

				const twoWashroomChecksQuery = await queryPool.query(
					`SELECT date FROM washroom_checks 
            		WHERE mens_initials IS NOT NULL AND womens_initials IS NOT NULL
            		AND date >= ($1 AT TIME ZONE 'UTC') AND date <= ($2 AT TIME ZONE 'UTC')`,
					[startDate, endDate],
				);
				const twoWashroomChecks = twoWashroomChecksQuery.rows;

				//Golden Washroom Checks
				const goldenWashroomChecksQuery = await queryPool.query(
					`SELECT date FROM washroom_checks
            		WHERE date >= ($1 AT TIME ZONE 'UTC') AND date <= ($2 AT TIME ZONE 'UTC')
            		GROUP BY date
            		HAVING 
            		    COUNT(*) = COUNT(mens_initials)
            		AND COUNT(*) = COUNT(womens_initials)`,
					[startDate, endDate],
				);
				const goldenWashroomChecks = goldenWashroomChecksQuery.rows;

				//Pool Checks
				const onePoolChecksQuery = await queryPool.query(
					`SELECT date FROM pool_checks 
            		WHERE ((mens_initials IS NOT NULL AND NOT womens_initials IS NOT NULL)
            		OR (womens_initials IS NOT NULL AND NOT mens_initials IS NOT NULL))
            		AND date >= ($1 AT TIME ZONE 'UTC') AND date <= ($2 AT TIME ZONE 'UTC')`,
					[startDate, endDate],
				);
				const onePoolChecks = onePoolChecksQuery.rows;

				const twoPoolChecksQuery = await queryPool.query(
					`SELECT date FROM pool_checks 
            		WHERE mens_initials IS NOT NULL AND womens_initials IS NOT NULL
            		AND date >= ($1 AT TIME ZONE 'UTC') AND date <= ($2 AT TIME ZONE 'UTC')`,
					[startDate, endDate],
				);
				const twoPoolChecks = twoPoolChecksQuery.rows;

				//Golden Pool Checks
				const goldenPoolChecksQuery = await queryPool.query(
					`SELECT date FROM pool_checks
            		WHERE date >= ($1 AT TIME ZONE 'UTC') AND date <= ($2 AT TIME ZONE 'UTC')
            		GROUP BY date
            		HAVING
            		    COUNT(*) = COUNT(mens_initials)
            		AND COUNT(*) = COUNT(womens_initials)`,
					[startDate, endDate],
				);
				const goldenPoolChecks = goldenPoolChecksQuery.rows;

				//Posted Shifts
				const postedShiftsQuery = await queryPool.query(
					`SELECT s.date FROM posted_shifts p
            		LEFT JOIN shift_reference s
            		USING (shift_id)
            		WHERE p.offered = false
            		AND s.date >= $1 AND s.date <= $2`,
					[startDate, endDate],
				);
				const postedShifts = postedShiftsQuery.rows;

				//Offered Shifts
				const offeredShiftsQuery = await queryPool.query(
					`SELECT s.date FROM posted_shifts p 
            		LEFT JOIN shift_reference s
            		USING (shift_id)
            		WHERE p.offered = true
            		AND s.date >= $1 AND s.date <= $2`,
					[startDate, endDate],
				);
				const offeredShifts = offeredShiftsQuery.rows;

				//Sick Shifts
				const sickShiftsQuery = await queryPool.query(
					`SELECT date FROM shift_reference
            		WHERE shift = 'SICK'
            		AND date >= ($1 AT TIME ZONE 'UTC') AND date <= ($2 AT TIME ZONE 'UTC')`,
					[startDate, endDate],
				);
				const sickShifts = sickShiftsQuery.rows;

				//Off Shifts
				const offShiftsQuery = await queryPool.query(
					`SELECT date FROM shift_reference
            		WHERE shift = 'OFF'
            		AND date >= ($1 AT TIME ZONE 'UTC') AND date <= ($2 AT TIME ZONE 'UTC')`,
					[startDate, endDate],
				);
				const offShifts = offShiftsQuery.rows;

				//Total Shifts
				const shiftsQuery = await queryPool.query(
					`SELECT date FROM shift_reference
            		WHERE active = true
            		AND shift NOT IN ('OFF', 'SICK')
            		AND date >= ($1 AT TIME ZONE 'UTC') AND date <= ($2 AT TIME ZONE 'UTC')`,
					[startDate, endDate],
				);
				const shifts = shiftsQuery.rows;

				//Total Schedulings
				const schedulingsQuery = await queryPool.query(
					`SELECT date FROM shift_reference
            		WHERE active = true
            		AND date >= ($1 AT TIME ZONE 'UTC') AND date <= ($2 AT TIME ZONE 'UTC')`,
					[startDate, endDate],
				);
				const schedulings = schedulingsQuery.rows;

				//Total Hours
				const dayArray = [
					'monday',
					'tuesday',
					'wednesday',
					'thursday',
					'friday',
					'saturday',
					'sunday',
				];

				const startDay = new Date(startDate)
					.toLocaleDateString('en-CA', { weekday: 'long', timeZone: 'UTC' })
					.toLowerCase();
				const endDay = new Date(endDate)
					.toLocaleDateString('en-CA', { weekday: 'long', timeZone: 'UTC' })
					.toLowerCase();

				const startWeek = getMondayOfWeek(startDate);
				const endWeek = getMondayOfWeek(endDate);

				const totalHoursQuery = await queryPool.query(
					`SELECT week_of, total_hours FROM schedule_hours
            		WHERE week_of >= $1 AND week_of < $2
            		ORDER BY week_of`,
					[startDate, endWeek],
				);

				const totalHourCount = totalHoursQuery.rows.map((row) => ({
					x: row.week_of.toISOString().split('T')[0],
					y: Number(row.total_hours),
				}));

				const experienceHoursQuery = await queryPool.query(
					`SELECT week_of, total_hours FROM experience_schedule_hours
            		WHERE week_of >= $1 AND week_of < $2
            		ORDER BY week_of`,
					[startDate, endWeek],
				);

				const experienceHourCount = experienceHoursQuery.rows.map((row) => ({
					x: row.week_of.toISOString().split('T')[0],
					y: Number(row.total_hours),
				}));

				if (startDay !== 'monday') {
					const startPartialWeek = dayArray.slice(dayArray.indexOf(startDay));

					const partialStartColumns = startPartialWeek.join(', ');
					const partialStartHoursQuery = await queryPool.query(
						`SELECT ${partialStartColumns} FROM schedule_hours
                		WHERE week_of = $1`,
						[startWeek],
					);

					if (partialStartHoursQuery.rows.length > 0) {
						const hours = Object.values(partialStartHoursQuery.rows[0]).reduce(
							(total, value) => total + Number(value),
							0,
						);
						const dataObj = { x: startDate, y: hours };

						totalHourCount.unshift(dataObj);
					}

					const partialStartExperienceHoursQuery = await queryPool.query(
						`SELECT ${partialStartColumns} FROM experience_schedule_hours
                		WHERE week_of = $1`,
						[startWeek],
					);

					if (partialStartExperienceHoursQuery.rows.length > 0) {
						const hours = Object.values(
							partialStartExperienceHoursQuery.rows[0],
						).reduce((total, value) => total + Number(value), 0);
						const dataObj = { x: startDate, y: hours };

						experienceHourCount.unshift(dataObj);
					}
				}

				const endPartialWeek = dayArray.slice(0, dayArray.indexOf(endDay) + 1);

				const partialEndColumns = endPartialWeek.join(', ');
				const partialEndHoursQuery = await queryPool.query(
					`SELECT ${partialEndColumns} FROM schedule_hours
                	WHERE week_of = $1`,
					[endWeek],
				);

				if (partialEndHoursQuery.rows.length > 0) {
					const hours = Object.values(partialEndHoursQuery.rows[0]).reduce(
						(total, value) => total + Number(value),
						0,
					);
					const dataObj = { x: endWeek, y: hours };

					totalHourCount.push(dataObj);
				}

				const partialEndExperienceHoursQuery = await queryPool.query(
					`SELECT ${partialEndColumns} FROM schedule_hours
                	WHERE week_of = $1`,
					[endWeek],
				);

				if (partialEndExperienceHoursQuery.rows.length > 0) {
					const hours = Object.values(
						partialEndExperienceHoursQuery.rows[0],
					).reduce((total, value) => total + Number(value), 0);
					const dataObj = { x: endWeek, y: hours };

					experienceHourCount.push(dataObj);
				}

				const pool_check_count = mergeAndSumCounts(
					onePoolChecks,
					twoPoolChecks,
					startDate,
					endDate,
				);
				const golden_pool_check_count = mergeAndSumCounts(
					goldenPoolChecks,
					[],
					startDate,
					endDate,
				);
				const washroom_check_count = mergeAndSumCounts(
					oneWashroomChecks,
					twoWashroomChecks,
					startDate,
					endDate,
				);
				const golden_washroom_check_count = mergeAndSumCounts(
					goldenWashroomChecks,
					[],
					startDate,
					endDate,
				);
				const posted_shift_count = mergeAndSumCounts(
					postedShifts,
					[],
					startDate,
					endDate,
				);
				const offered_shift_count = mergeAndSumCounts(
					offeredShifts,
					[],
					startDate,
					endDate,
				);
				const sick_shift_count = mergeAndSumCounts(
					sickShifts,
					[],
					startDate,
					endDate,
				);
				const off_shift_count = mergeAndSumCounts(
					offShifts,
					[],
					startDate,
					endDate,
				);
				const shift_count = mergeAndSumCounts(shifts, [], startDate, endDate);
				const schedulings_count = mergeAndSumCounts(
					schedulings,
					[],
					startDate,
					endDate,
				);

				const total_hour_count = totalHourCount.filter((_, index, array) => {
					const firstNonZeroIndex = array.findIndex((obj) => obj.y !== 0);

					let lastNonZeroIndex = -1;
					for (let i = array.length - 1; i >= 0; i--) {
						if (array[i].y !== 0) {
							lastNonZeroIndex = i;
							break;
						}
					}

					return index >= firstNonZeroIndex && index <= lastNonZeroIndex;
				});

				const experience_hour_count = experienceHourCount.filter(
					(_, index, array) => {
						const firstNonZeroIndex = array.findIndex((obj) => obj.y !== 0);

						let lastNonZeroIndex = -1;
						for (let i = array.length - 1; i >= 0; i--) {
							if (array[i].y !== 0) {
								lastNonZeroIndex = i;
								break;
							}
						}

						return index >= firstNonZeroIndex && index <= lastNonZeroIndex;
					},
				);

				const clubData = {
					pool_check_count,
					golden_pool_check_count,
					washroom_check_count,
					golden_washroom_check_count,
					posted_shift_count,
					offered_shift_count,
					sick_shift_count,
					off_shift_count,
					shift_count,
					schedulings_count,
					total_hour_count,
					experience_hour_count,
				};
				const clubDataObj = { ...clubData, club_id: database.club_id };
				allData.push(clubDataObj);
			} catch (clubErr) {
				console.warn(
					`[${new Date().toISOString()}]`,
					'Error at /api/club-data:',
					err,
				);
				continue;
			} finally {
				if (user.dbName === 'director_dashboard') {
					await queryPool.end();
				}
			}
		}

		res.json(allData);
	} catch (err) {
		console.error(
			`[${new Date().toISOString()}]`,
			'Error at /api/club-data:',
			err,
		);
		res.status(500).send('Server error');
	}
});

app.get('/api/employee-data', async (req, res) => {
	const pool = req.pool;
	const user = req.user;
	const range = JSON.parse(decodeURIComponent(req.query.dateRange));
	const [start, end] = range;
	const startDate = start ? new Date(start) : new Date('2024-09-01');
	const endDate = end ? new Date(end) : new Date();
	endDate.setUTCHours(23, 59, 59, 999);

	try {
		const employeesResult = await pool.query(
			`SELECT name, employee_id, department_id, initials 
            FROM employees 
            WHERE active = true
            AND (
                department_id IN  (1, 2, 4)
                OR (department_id = 3 AND initials IS NOT NULL)
            )
            ORDER BY name`,
		);
		const employeeDataArray = employeesResult.rows;

		for (const employee of employeeDataArray) {
			const postedShifts = await pool.query(
				`SELECT COUNT(*) FROM posted_shifts p
                LEFT JOIN shift_reference s
                USING (shift_id)
                WHERE p.employee_id = $1
                AND p.offered = false
                AND s.date >= ($2 AT TIME ZONE 'UTC') AND s.date <= ($3 AT TIME ZONE 'UTC')`,
				[employee.employee_id, startDate, endDate],
			);

			const offeredShifts = await pool.query(
				`SELECT COUNT(*) FROM posted_shifts p 
                LEFT JOIN shift_reference s
                USING (shift_id)
                WHERE p.employee_id = $1
                AND p.offered = true
                AND s.date >= ($2 AT TIME ZONE 'UTC') AND s.date <= ($3 AT TIME ZONE 'UTC')`,
				[employee.employee_id, startDate, endDate],
			);

			const takes = await pool.query(
				`SELECT COUNT (*) FROM offers o
                LEFT JOIN shift_reference s
                ON o.take_id = s.shift_id
                WHERE o.employee_id = $1
                AND o.give_id IS NULL
                AND s.date >= ($2 AT TIME ZONE 'UTC') AND s.date <= ($3 AT TIME ZONE 'UTC')`,
				[employee.employee_id, startDate, endDate],
			);

			const trades = await pool.query(
				`SELECT COUNT (*) FROM offers o
                LEFT JOIN shift_reference s
                ON o.take_id = s.shift_id
                WHERE o.employee_id = $1
                AND o.give_id IS NOT NULL
                AND s.date >= ($2 AT TIME ZONE 'UTC') AND s.date <= ($3 AT TIME ZONE 'UTC')`,
				[employee.employee_id, startDate, endDate],
			);

			const sickShifts = await pool.query(
				`SELECT COUNT(*) FROM shift_reference s
                LEFT JOIN posted_schedules p
                USING (week_of)
                WHERE s.employee_id = $1 AND s.shift = 'SICK' 
                AND (p.experience OR p.facilities)
                AND s.active = true
                AND s.date >= ($2 AT TIME ZONE 'UTC') AND s.date <= ($3 AT TIME ZONE 'UTC')`,
				[employee.employee_id, startDate, endDate],
			);

			const offShifts = await pool.query(
				`SELECT COUNT(*) FROM shift_reference s
                LEFT JOIN posted_schedules p
                USING (week_of)
                WHERE s.employee_id = $1 AND s.shift = 'OFF' 
                AND (p.experience OR p.facilities)
                AND s.active = true
                AND s.date >= ($2 AT TIME ZONE 'UTC') AND s.date <= ($3 AT TIME ZONE 'UTC')`,
				[employee.employee_id, startDate, endDate],
			);

			if (employee.department_id === 3) {
				const washroomChecks = await pool.query(
					`SELECT COUNT(*) FROM washroom_checks 
                    WHERE (mens_initials = $1 OR womens_initials = $1)
                    AND date >= ($2 AT TIME ZONE 'UTC') AND date <= ($3 AT TIME ZONE 'UTC')`,
					[employee.initials, startDate, endDate],
				);

				const goldenWashroomChecks = await pool.query(
					`SELECT COUNT(*) 
                    FROM (
                        SELECT date FROM washroom_checks
                        WHERE date >= ($1 AT TIME ZONE 'UTC') AND date <= ($2 AT TIME ZONE 'UTC')
                        GROUP BY date
                        HAVING
                            COUNT(*) = COUNT(mens_initials)
                        AND COUNT(*) = COUNT(womens_initials)
                        AND (
                            SUM(CASE WHEN mens_initials = $3 THEN 1 ELSE 0 END) >= 1
                            OR
                            SUM(CASE WHEN womens_initials = $3 THEN 1 ELSE 0 END) >= 1
                        )
                    )`,
					[startDate, endDate, employee.initials],
				);

				const onePoolChecks = await pool.query(
					`SELECT COUNT(*) FROM pool_checks 
                    WHERE ((mens_initials = $1 AND NOT womens_initials = $1)
                    OR (womens_initials = $1 AND NOT mens_initials = $1))
                    AND date >= ($2 AT TIME ZONE 'UTC') AND date <= ($3 AT TIME ZONE 'UTC')`,
					[employee.initials, startDate, endDate],
				);

				const twoPoolChecks = await pool.query(
					`SELECT COUNT(*) FROM pool_checks 
                    WHERE mens_initials = $1 AND womens_initials = $1
                    AND date >= ($2 AT TIME ZONE 'UTC') AND date <= ($3 AT TIME ZONE 'UTC')`,
					[employee.initials, startDate, endDate],
				);

				const goldenPoolChecks = await pool.query(
					`SELECT COUNT(*) 
                    FROM (
                        SELECT date FROM pool_checks
                        WHERE date >= ($1 AT TIME ZONE 'UTC') AND date <= ($2 AT TIME ZONE 'UTC')
                        GROUP BY date
                        HAVING
                            COUNT(*) = COUNT(mens_initials)
                        AND COUNT(*) = COUNT(womens_initials)
                        AND (
                            SUM(CASE WHEN mens_initials = $3 THEN 1 ELSE 0 END) >= 1
                            OR
                            SUM(CASE WHEN womens_initials = $3 THEN 1 ELSE 0 END) >= 1
                        )
                    )`,
					[startDate, endDate, employee.initials],
				);

				const twoPools = twoPoolChecks.rows[0].count * 2;
				const pool_check_count = `${parseInt(onePoolChecks.rows[0].count) + twoPools}`;

				employee.washroom_check_count = washroomChecks.rows[0].count;
				employee.golden_washroom_check_count =
					goldenWashroomChecks.rows[0].count;
				employee.pool_check_count = pool_check_count;
				employee.golden_pool_check_count = goldenPoolChecks.rows[0].count;
			}

			const totalHoursQuery = await pool.query(
				`SELECT length FROM shift_reference
                WHERE employee_id = $1
                AND active = true
                AND date >= ($2 AT TIME ZONE 'UTC') AND date <= ($3 AT TIME ZONE 'UTC')`,
				[employee.employee_id, startDate, endDate],
			);
			const totalHours = `${totalHoursQuery.rows.reduce((sum, obj) => sum + parseFloat(obj.length), 0)}`;

			const shifts = await pool.query(
				`SELECT COUNT(*) FROM shift_reference
                WHERE employee_id = $1
                AND active = true
                AND shift NOT IN ('OFF', 'SICK')
                AND date >= ($2 AT TIME ZONE 'UTC') AND date <= ($3 AT TIME ZONE 'UTC')`,
				[employee.employee_id, startDate, endDate],
			);

			const schedulings = await pool.query(
				`SELECT COUNT(*) FROM shift_reference
                WHERE employee_id = $1
                AND active = true
                AND date >= ($2 AT TIME ZONE 'UTC') AND date <= ($3 AT TIME ZONE 'UTC')`,
				[employee.employee_id, startDate, endDate],
			);

			let clubId = null;

			if (user.dbName === 'director_dashboard') {
				const clubIdQuery = await pool.query(
					`SELECT club_id FROM employees
                    WHERE employee_id = $1`,
					[employee.employee_id],
				);
				clubId = clubIdQuery.rows[0].club_id;
			}

			employee.posted_shift_count = postedShifts.rows[0].count;
			employee.offered_shift_count = offeredShifts.rows[0].count;
			employee.take_count = takes.rows[0].count;
			employee.trade_count = trades.rows[0].count;
			employee.sick_shift_count = sickShifts.rows[0].count;
			employee.off_shift_count = offShifts.rows[0].count;
			employee.total_hour_count = totalHours;
			employee.shift_count = shifts.rows[0].count;
			employee.schedulings_count = schedulings.rows[0].count;
			employee.club_id = clubId;
		}

		res.json(employeeDataArray);
	} catch (err) {
		console.error(`[${new Date().toISOString()}]`, err);
		res.status(500).send('Server error');
	}
});

app.get('/api/monthly-check-data', async (req, res) => {
	const isDemo = process.env.VITE_NODE_TYPE === 'demo';
	const pool = req.pool;

	let firstOfMonth = new Date(
		new Date().getFullYear(),
		new Date().getMonth(),
		1,
	);
	let lastOfMonth = new Date(
		new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0),
	);

	if (isDemo) {
		firstOfMonth = new Date('2025-01-01');
		lastOfMonth = new Date('2025-01-31');
	}

	lastOfMonth.setUTCHours(23, 59, 59, 999);

	try {
		const employeesResult = await pool.query(
			`SELECT name, employee_id, department_id, initials 
            FROM employees 
            WHERE active = true
            AND department_id = 3 
            AND initials IS NOT NULL
            ORDER BY name`,
		);
		const employeeDataArray = employeesResult.rows;

		for (const employee of employeeDataArray) {
			const washroomChecks = await pool.query(
				`SELECT COUNT(*) FROM washroom_checks 
                WHERE (mens_initials = $1 OR womens_initials = $1)
                AND (date >= ($2 AT TIME ZONE 'UTC') AND date <= ($3 AT TIME ZONE 'UTC'))`,
				[employee.initials, firstOfMonth, lastOfMonth],
			);

			const onePoolChecks = await pool.query(
				`SELECT COUNT(*) FROM pool_checks 
                WHERE (
                    (mens_initials = $1 AND (womens_initials != $1 OR womens_initials IS NULL))
                    OR (womens_initials = $1 AND (mens_initials != $1 OR mens_initials IS NULL))
                )
                AND (date >= ($2 AT TIME ZONE 'UTC') AND date <= ($3 AT TIME ZONE 'UTC'))`,
				[employee.initials, firstOfMonth, lastOfMonth],
			);

			const twoPoolChecks = await pool.query(
				`SELECT COUNT(*) FROM pool_checks 
                WHERE mens_initials = $1 AND womens_initials = $1
                AND (date >= ($2 AT TIME ZONE 'UTC') AND date <= ($3 AT TIME ZONE 'UTC'))`,
				[employee.initials, firstOfMonth, lastOfMonth],
			);

			const twoPools = twoPoolChecks.rows[0].count * 2;
			const pool_check_count = `${parseInt(onePoolChecks.rows[0].count) + twoPools}`;

			const totalHoursQuery = await pool.query(
				`SELECT length FROM shift_reference
                WHERE employee_id = $1
                AND date >= $2
                AND date <= CURRENT_DATE
                AND active = true`,
				[employee.employee_id, firstOfMonth],
			);

			const totalHours = `${totalHoursQuery.rows.reduce((sum, obj) => sum + parseFloat(obj.length), 0)}`;

			employee.washroom_check_count = washroomChecks.rows[0].count;
			employee.pool_check_count = pool_check_count;
			employee.total_hour_count = totalHours;
		}

		res.json(employeeDataArray);
	} catch (err) {
		console.error(`[${new Date().toISOString()}]`, err);
		res.status(500).send('Server error');
	}
});
