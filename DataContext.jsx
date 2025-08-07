import React, {
	createContext,
	useContext,
	useState,
	useEffect,
	useCallback,
} from 'react';
import logger from '../modules/logger';
import { useWebSocketContext } from './WebSocketContext';
import { useAppSettings } from './AppSettingsContext';
import { useActiveIndex } from './ActiveIndexContext';
import { useDemo } from '../components/Demo/DemoContext';

const DataContext = createContext();

const DataProvider = ({ children, isAuthenticated, user }) => {
	const [clubData, setClubData] = useState({});
	const [clubPercentageData, setClubPercentageData] = useState([]);
	const [rawEmployeeData, setRawEmployeeData] = useState([]);
	const [employeeData, setEmployeeData] = useState([]);
	const [employeePercentageData, setEmployeePercentageData] = useState([]);
	const [monthlyCheckData, setMonthlyCheckData] = useState([]);
	const [monthlyCheckPercentageData, setMonthlyCheckPercentageData] = useState(
		[],
	);
	// Start of date range for data fetching
	const [rangeStart, setRangeStart] = useState(null);
	// End of date range
	const [rangeEnd, setRangeEnd] = useState(null);
	// Triggers update of data visualization
	const [rangeReady, setRangeReady] = useState(true);
	const [weeklyClubHours, setWeeklyClubHours] = useState(120);
	const [weekdayClubHours, setWeekdayClubHours] = useState(18);
	const [weekendClubHours, setWeekendClubHours] = useState(15);
	const [elapsedWeeklyHours, setElapsedWeeklyHours] = useState(120);

	const { broadcastMessage, setBroadcastMessage } = useWebSocketContext();
	const { isDemo } = useDemo();
	const { activeIndex } = useActiveIndex();
	const {
		weekClubOpenIndex,
		weekClubCloseIndex,
		weekendClubOpenIndex,
		weekendClubCloseIndex,
	} = useAppSettings();

	useEffect(() => {
		// Indexes are the time in 10-minute increments starting at 12:00AM
		const weekdayHours =
			(weekClubCloseIndex * 10 - weekClubOpenIndex * 10) / 60;
		const weekendHours =
			(weekendClubCloseIndex * 10 - weekendClubOpenIndex * 10) / 60;

		const weeklyHours = weekdayHours * 5 + weekendHours * 2;

		setWeekdayClubHours(weekdayHours);
		setWeekendClubHours(weekendHours);
		setWeeklyClubHours(weeklyHours);
	}, [
		weekClubOpenIndex,
		weekClubCloseIndex,
		weekendClubOpenIndex,
		weekendClubCloseIndex,
	]);

	useEffect(() => {
		// Calculate elapsed operational hours within the current week
		// Adjusts for different weekend vs weekday schedules
		const date = rangeEnd ? new Date(rangeEnd) : new Date();
		if (rangeEnd) date.setHours(23, 0, 0, 0);
		const day = date.getDay();

		// Determine opening time based on day type (weekend uses different hours)
		const openTime = [0, 6].includes(day)
			? weekendClubOpenIndex / 6
			: weekClubOpenIndex / 6;

		// Calculate hours elapsed since opening, minimum 0
		const currentHours = Math.max(0, date.getHours() - openTime);

		// If today is a weekend day, calculate elapsed weekend club hours and add 5 weekdays worth of hours
		// Else, just calculate elapsed weekday hours
		let elapsedHours;
		if ([0, 6].includes(day)) {
			const weekendElapsed =
				day === 0 ? currentHours + weekendClubHours : currentHours;
			elapsedHours = weekdayClubHours * 5 + weekendElapsed;
		} else {
			elapsedHours = (day - 1) * weekdayClubHours + currentHours;
		}

		setElapsedWeeklyHours(elapsedHours);
	}, [
		weekdayClubHours,
		weekendClubHours,
		activeIndex,
		weekClubOpenIndex,
		weekendClubOpenIndex,
		rangeEnd,
	]);

	const fetchClubData = useCallback(async () => {
		if (!user?.isManager) return;

		let start = rangeStart;
		let end = rangeEnd;
		if (rangeStart) start = rangeStart.toLocaleDateString('en-CA');
		if (rangeEnd) end = rangeEnd.toLocaleDateString('en-CA');
		const range = [start, end];

		try {
			const response = await fetch(
				`/api/club-data?dateRange=
                ${encodeURIComponent(JSON.stringify(range))}`,
				{
					method: 'GET',
					credentials: 'include',
				},
			);

			if (!response.ok) {
				const errorResponse = await response.text();
				throw new Error(errorResponse);
			}

			const data = await response.json();

			logger('Club Data:', data);
			const sortedData = data.sort((a, b) => a.club_id - b.club_id);
			setClubData(sortedData);
			setRangeReady(false);
		} catch (error) {
			console.error('Error fetching club data:', error.message);
		}
	}, [user?.isManager, rangeStart, rangeEnd]);

	const fetchEmployeeData = useCallback(async () => {
		if (!user?.isManager) return;

		let start = rangeStart;
		let end = rangeEnd;
		if (rangeStart) start = rangeStart.toLocaleDateString('en-CA');
		if (rangeEnd) end = rangeEnd.toLocaleDateString('en-CA');
		const range = [start, end];

		try {
			const response = await fetch(
				`/api/employee-data?dateRange=${encodeURIComponent(JSON.stringify(range))}`,
				{
					method: 'GET',
					credentials: 'include',
				},
			);

			if (!response.ok) {
				const errorResponse = await response.text();
				throw new Error(errorResponse);
			}

			const data = await response.json();

			setRawEmployeeData(data);
		} catch (error) {
			console.error('Error fetching employee data:', error.message);
		}
	}, [user?.isManager, rangeStart, rangeEnd]);

	const fetchMonthlyCheckData = useCallback(async () => {
		try {
			const response = await fetch(`/api/monthly-check-data`, {
				method: 'GET',
				credentials: 'include',
			});

			if (!response.ok) {
				const errorResponse = await response.text();
				throw new Error(errorResponse);
			}

			const data = await response.json();

			logger('Monthly Check Data:', data);
			setMonthlyCheckData(data);
		} catch (error) {
			console.error('Error fetching monthly check data:', error.message);
		}
	}, []);

	useEffect(() => {
		if (isAuthenticated && rangeReady) {
			fetchClubData();
			fetchEmployeeData();
			fetchMonthlyCheckData();
		}
	}, [
		fetchEmployeeData,
		isAuthenticated,
		fetchMonthlyCheckData,
		fetchClubData,
		rangeReady,
	]);

	useEffect(() => {
		if (isAuthenticated && isDemo) {
			const interval = setInterval(() => {
				fetchClubData();
				fetchEmployeeData();
				fetchMonthlyCheckData();
			}, 10000);

			return () => clearInterval(interval);
		}
	}, [
		isAuthenticated,
		isDemo,
		fetchClubData,
		fetchEmployeeData,
		fetchMonthlyCheckData,
	]);

	useEffect(() => {
		if (['UPDATE_SCHEDULE', 'UPDATE_SNAPSHOT'].includes(broadcastMessage)) {
			fetchClubData();
			fetchEmployeeData();
			fetchMonthlyCheckData();
			setBroadcastMessage('');
		}
	}, [
		broadcastMessage,
		setBroadcastMessage,
		fetchClubData,
		fetchEmployeeData,
		fetchMonthlyCheckData,
	]);

	const percentageConverter = (value, divisor, isWashroomCheck = false) => {
		if (Number(divisor) === 0) return '0';
		if (isWashroomCheck) {
			return ((Number(value) / (divisor * 2)) * 100).toFixed(1);
		} else {
			return ((Number(value) / divisor) * 100).toFixed(1);
		}
	};

	useEffect(() => {
		// Prepares club data for graphs
		if (clubData && clubData.length > 0) {
			const percentageClubData = [];
			for (const club of clubData) {
				let updatedClubData;
				try {
					updatedClubData = JSON.parse(JSON.stringify(club));
				} catch (err) {
					console.error('Failed to clone clubData:', club);
					return;
				}

				const totalShiftsMap = updatedClubData.shift_count.reduce(
					(acc, { x, y }) => {
						acc[x] = y;
						return acc;
					},
					{},
				);

				const totalSchedulingsMap = updatedClubData.schedulings_count.reduce(
					(acc, { x, y }) => {
						acc[x] = y;
						return acc;
					},
					{},
				);

				/*
					Club compliance percentage calculator
					Handles multiple business rules for different metric types:
					 - Washroom checks: Expected every 30min (2x hourly rate)
					 - Posted/Offered shifts: Percentage of actual shifts (excludes special shifts)
					 - Sick/Off shifts: Percentage of "schedulings" (includes actual shifts AND special shifts)
					 - Golden checks: Per-shift basis (daily compliance)
				*/
				[
					'pool_check_count',
					'golden_pool_check_count',
					'washroom_check_count',
					'golden_washroom_check_count',
					'posted_shift_count',
					'offered_shift_count',
					'sick_shift_count',
					'off_shift_count',
				].forEach((key) => {
					if (updatedClubData[key]) {
						updatedClubData[key].forEach((week, index) => {
							if (
								totalShiftsMap[week.x] !== undefined &&
								totalSchedulingsMap[week.x] !== undefined
							) {
								const lastDate = new Date(
									updatedClubData[key][updatedClubData[key].length - 1].x,
								);
								const now = new Date();
								now.setUTCHours(0, 0, 0, 0);
								const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
								const isMoreThan7DaysPast = now - lastDate >= sevenDaysMs;
								const isLastEntry = index === updatedClubData[key].length - 1;
								const sunday = new Date(`${week.x}T00:00:00`);
								sunday.setDate(sunday.getDate() + 6);
								/* 
									This determines whether the divisor should be the currently elapsed 
									hours or the full weekly hours.
								*/
								const shouldUseElapsed =
									isLastEntry && // This is the most recent week
									((!rangeEnd && !isMoreThan7DaysPast) || // Current week with no range end
										(rangeEnd && rangeEnd < sunday)); // Range ends mid-week

								const weeklyHours = shouldUseElapsed
									? elapsedWeeklyHours
									: weeklyClubHours;
								const daysElapsed = shouldUseElapsed
									? rangeEnd
										? rangeEnd.getDay() || 7
										: now.getDay()
									: 7;

								if (key === 'washroom_check_count') {
									week.y = Number(
										percentageConverter(week.y, weeklyHours * 2, true),
									);
								} else if (
									['posted_shift_count', 'offered_shift_count'].includes(key)
								) {
									week.y = Number(
										percentageConverter(week.y, totalShiftsMap[week.x]),
									);
								} else if (
									['sick_shift_count', 'off_shift_count'].includes(key)
								) {
									week.y = Number(
										percentageConverter(week.y, totalSchedulingsMap[week.x]),
									);
								} else if (
									[
										'golden_pool_check_count',
										'golden_washroom_check_count',
									].includes(key)
								) {
									week.y = Number(percentageConverter(week.y, daysElapsed));
								} else {
									week.y = Number(percentageConverter(week.y, weeklyHours));
								}
							}
						});
					}
				});
				percentageClubData.push(updatedClubData);
			}

			setClubPercentageData(percentageClubData);
		}
	}, [clubData, elapsedWeeklyHours, rangeEnd, weeklyClubHours]);

	useEffect(() => {
		// Prepares employee data for employee table and graphs
		if (rawEmployeeData.length > 0) {
			const updatedEmployeeData = rawEmployeeData.map((employee) => {
				if (!employee) return employee;

				const updatedEmployee = JSON.parse(JSON.stringify(employee));

				/*
					Employee compliance percentage calculator
					Handles multiple business rules for different metric types:
					 - Washroom checks: Expected every 30min (2x hourly rate)
					 - Posted/Offered shifts: Percentage of actual shifts (excludes special shifts)
					 - Sick/Off shifts: Percentage of "schedulings" (includes actual shifts AND special shifts)
					 - Golden checks: Per-shift basis (daily compliance)
				*/
				if (updatedEmployee.pool_check_count) {
					updatedEmployee.pool_check_count = percentageConverter(
						updatedEmployee.pool_check_count,
						updatedEmployee.total_hour_count,
					);
					updatedEmployee.golden_pool_check_count = percentageConverter(
						updatedEmployee.golden_pool_check_count,
						updatedEmployee.shift_count,
					);
				}

				if (updatedEmployee.washroom_check_count) {
					updatedEmployee.washroom_check_count = percentageConverter(
						updatedEmployee.washroom_check_count,
						updatedEmployee.total_hour_count,
						true,
					);
					updatedEmployee.golden_washroom_check_count = percentageConverter(
						updatedEmployee.golden_washroom_check_count,
						updatedEmployee.shift_count,
					);
				}

				updatedEmployee.posted_shift_count = percentageConverter(
					updatedEmployee.posted_shift_count,
					updatedEmployee.shift_count,
				);
				updatedEmployee.offered_shift_count = percentageConverter(
					updatedEmployee.offered_shift_count,
					updatedEmployee.shift_count,
				);
				updatedEmployee.sick_shift_count = percentageConverter(
					updatedEmployee.sick_shift_count,
					updatedEmployee.schedulings_count,
				);
				updatedEmployee.off_shift_count = percentageConverter(
					updatedEmployee.off_shift_count,
					updatedEmployee.schedulings_count,
				);

				return updatedEmployee;
			});

			// Group employees by club for director dashboard
			const groupedByClub = rawEmployeeData.reduce((acc, item) => {
				const { club_id } = item;
				if (!acc[club_id]) {
					acc[club_id] = [];
				}
				acc[club_id].push(item);
				return acc;
			}, {});

			const clubEmployeeData = Object.values(groupedByClub);

			// Same as above but for percentage values
			const percentageGroupedByClub = updatedEmployeeData.reduce(
				(acc, item) => {
					const { club_id } = item;
					if (!acc[club_id]) {
						acc[club_id] = [];
					}
					acc[club_id].push(item);
					return acc;
				},
				{},
			);

			const percentageClubEmployeeData = Object.values(percentageGroupedByClub);

			setEmployeeData(clubEmployeeData);
			setEmployeePercentageData(percentageClubEmployeeData);
			logger('Employee Data:', clubEmployeeData);
		}
	}, [rawEmployeeData]);

	useEffect(() => {
		// Simpler but operates the same as other data processing blocks
		// Prepares data for monthly check competition component
		if (monthlyCheckData.length > 0) {
			const updatedMonthlyCheckData = monthlyCheckData.map((employee) => {
				if (!employee) return employee;

				const updatedEmployee = JSON.parse(JSON.stringify(employee));

				updatedEmployee.pool_check_count = percentageConverter(
					updatedEmployee.pool_check_count,
					updatedEmployee.total_hour_count,
				);
				updatedEmployee.washroom_check_count = percentageConverter(
					updatedEmployee.washroom_check_count,
					updatedEmployee.total_hour_count,
					true,
				);

				return updatedEmployee;
			});

			setMonthlyCheckPercentageData(updatedMonthlyCheckData);
		}
	}, [monthlyCheckData]);

	return (
		<DataContext.Provider
			value={{
				employeeData,
				employeePercentageData,
				monthlyCheckData,
				monthlyCheckPercentageData,
				clubData,
				clubPercentageData,
				rangeStart,
				setRangeStart,
				rangeEnd,
				setRangeEnd,
				setRangeReady,
			}}
		>
			{children}
		</DataContext.Provider>
	);
};

const useData = () => useContext(DataContext);

export { DataProvider, useData };
