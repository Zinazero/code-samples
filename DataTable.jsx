import React, { useState, useEffect, useMemo } from 'react';
import { useData } from '../../../../contexts/DataContext';
import { AnimatePresence, motion } from 'framer-motion';
import {
	itemVariants,
	listVariants,
	noopVariants,
} from '../../../../modules/animationVariants';
import { useAppSettings } from '../../../../contexts/AppSettingsContext';

const DataTable = ({ isPercentage }) => {
	const [department, setDepartment] = useState('experience');
	const [tableData, setTableData] = useState([]);

	const { employeeData, employeePercentageData } = useData();
	const { animationsDisabled } = useAppSettings();
	const bodyVariants = animationsDisabled ? noopVariants : listVariants;
	const rowVariants = animationsDisabled ? noopVariants : itemVariants;

	const dataList = useMemo(() => {
		const departmentMap = {
			management: 1,
			sales: 2,
			experience: 3,
			facilities: 4,
		};

		const departmentId = departmentMap[department];

		if (!departmentId) {
			console.error(
				`Error: Invalid department "${department}" in DataCenterModal.js`,
			);
			return [];
		}

		const data = isPercentage ? employeePercentageData : employeeData;

		return data?.length > 0
			? data.filter((employee) => employee.department_id === departmentId)
			: [];
	}, [employeeData, employeePercentageData, department, isPercentage]);

	useEffect(() => {
		if (!isPercentage) {
			if (employeeData?.length > 0) setTableData(dataList);
		} else {
			if (employeePercentageData?.length > 0) setTableData(dataList);
		}
	}, [employeeData, employeePercentageData, dataList, isPercentage]);

	/*
		Performance-based colour coding algorithm
		Identifies best performer for each metric and highlights accordingly
		value {string}: Current employee's value for this metric
		stat {string}: Metric type (determines if higher or lower is better)
		hours {number}: Total hours worked (for per-hour calculations)
		isPerHour {boolean}: Whether to calculate per-hour performance
	*/
	const colourCoder = (value, stat, hours, isPerHour) => {
		if (!tableData.length) return '';

		// Convert to per-hour rate if needed for fair comparison
		const number = isPerHour ? Number(value) / hours : Number(value);

		// Metrics where HIGHER values indicate better performance
		const highArray = [
			'offered_shift_count',
			'washroom_check_count',
			'pool_check_count',
			'take_count',
			'trade_count',
		];

		// Metrics where LOWER values indicate better performance
		const lowArray = [
			'posted_shift_count',
			'sick_shift_count',
			'off_shift_count',
		];

		let bestScore;

		if (highArray.includes(stat)) {
			// Find maximum performer (higher is better)
			bestScore = tableData.reduce((max, obj) => {
				const objValue = isPerHour
					? obj.total_hour_count > 0
						? Number(obj[stat]) / obj.total_hour_count
						: 0
					: Number(obj[stat]);
				const maxValue = isPerHour
					? max.total_hour_count > 0
						? Number(max[stat]) / max.total_hour_count
						: 0
					: Number(max[stat]);
				return objValue > maxValue ? obj : max;
			}, tableData[0]);
		} else if (lowArray.includes(stat)) {
			// Find minimum performer (lower is better)
			bestScore = tableData.reduce((min, obj) => {
				const objValue = isPerHour
					? obj.total_hour_count > 0
						? Number(obj[stat]) / obj.total_hour_count
						: 0
					: Number(obj[stat]);
				const minValue = isPerHour
					? min.total_hour_count > 0
						? Number(min[stat]) / min.total_hour_count
						: 0
					: Number(min[stat]);
				return objValue < minValue ? obj : min;
			}, tableData[0]);
		} else {
			console.error(
				'Invalid stat or value in colourCoder.',
				'Value:',
				value,
				'Stat:',
				stat,
			);
			return '';
		}

		const bestValue = isPerHour
			? bestScore.total_hour_count > 0
				? Number(bestScore[stat]) / bestScore.total_hour_count
				: 0
			: Number(bestScore[stat]);

		// Highlight best performing values
		if (number === bestValue) return 'text-green';
		if (Number(number) === 0 || !value) return 'text-transparent-grey';
		return '';
	};

	return (
		<>
			<div className='flex justify-center mt-5'>
				<select
					id='data-department-select'
					value={department}
					onChange={(e) => setDepartment(e.target.value)}
					className={`
                                appearance-none rounded-lg shadow-md p-1 hover:text-brand focus:text-brand
                                bg-white text-center transition 
                            `}
				>
					<option value='management'>Management</option>
					<option value='experience'>Experience</option>
					<option value='facilities'>Facilities</option>
					<option value='sales'>Sales</option>
				</select>
			</div>
			<div>
				<table className='w-full'>
					<thead>
						<tr>
							<th></th>
							<th></th>
							<th></th>
							<th></th>
							<th></th>
							<th></th>
							{department === 'experience' && (
								<>
									<th colSpan={2} className='border-b-2 border-cobalt-light'>
										Checks
									</th>
								</>
							)}
						</tr>
						<tr>
							<th>Name</th>
							<th>Posted</th>
							<th>Offered</th>
							<th>Sick</th>
							<th>Off</th>
							<th>Shifts</th>
							{department === 'experience' && (
								<>
									<th>Washroom</th>
									<th>Pool</th>
								</>
							)}
							<th>Total Hours</th>
							<th>Takes</th>
							<th>Trades</th>
						</tr>
					</thead>
					<motion.tbody
						key={JSON.stringify(tableData)}
						variants={bodyVariants}
						initial='hidden'
						animate='visible'
						exit='exit'
					>
						<AnimatePresence mode='popLayout'>
							{tableData?.map((employee) => (
								<motion.tr key={employee.employee_id} variants={rowVariants}>
									<td className='text-left'>{employee.name}</td>
									<td
										className={`${colourCoder(employee.posted_shift_count, 'posted_shift_count', employee.shift_count)}`}
									>
										<span>
											{employee.posted_shift_count || '-'}
											{isPercentage && '%'}
										</span>
									</td>
									<td
										className={`${colourCoder(employee.offered_shift_count, 'offered_shift_count', employee.shift_count)}`}
									>
										<span>
											{employee.offered_shift_count || '-'}
											{isPercentage && '%'}
										</span>
									</td>
									<td
										className={`${colourCoder(employee.sick_shift_count, 'sick_shift_count', employee.shift_count)}`}
									>
										<span>
											{employee.sick_shift_count || '-'}
											{isPercentage && '%'}
										</span>
									</td>
									<td
										className={`${colourCoder(employee.off_shift_count, 'off_shift_count', employee.shift_count)}`}
									>
										<span>
											{employee.off_shift_count || '-'}
											{isPercentage && '%'}
										</span>
									</td>
									<td>
										{employee.shift_count ? (
											<span>{employee.shift_count}</span>
										) : (
											<span className='text-transparent-grey'>-</span>
										)}
									</td>
									{department === 'experience' && (
										<>
											<td
												className={`${colourCoder(employee.washroom_check_count, 'washroom_check_count', employee.total_hour_count)}`}
											>
												<div className='grid grid-cols-2'>
													<span>
														{employee.washroom_check_count || '-'}
														{isPercentage && '%'}
													</span>
													<span className='!text-yellow'>
														{employee.golden_washroom_check_count || '-'}
														{isPercentage && '%'}
													</span>
												</div>
											</td>
											<td
												className={`${colourCoder(employee.pool_check_count, 'pool_check_count', employee.total_hour_count)}`}
											>
												<div className='grid grid-cols-2'>
													<span>
														{employee.pool_check_count || '-'}
														{isPercentage && '%'}
													</span>
													<span className='!text-yellow'>
														{employee.golden_pool_check_count || '-'}
														{isPercentage && '%'}
													</span>
												</div>
											</td>
										</>
									)}
									<td>
										{employee.total_hour_count ? (
											<span>{employee.total_hour_count}</span>
										) : (
											<span className='text-transparent-grey'>-</span>
										)}
									</td>
									<td>
										{employee.take_count ? (
											<span
												className={`${colourCoder(employee.take_count, 'take_count')}`}
											>
												{employee.take_count}
											</span>
										) : (
											<span className='text-transparent-grey'>-</span>
										)}
									</td>
									<td>
										{employee.trade_count ? (
											<span
												className={`${colourCoder(employee.trade_count, 'trade_count')}`}
											>
												{employee.trade_count}
											</span>
										) : (
											<span className='text-transparent-grey'>-</span>
										)}
									</td>
								</motion.tr>
							))}
						</AnimatePresence>
					</motion.tbody>
				</table>
			</div>
		</>
	);
};

export default DataTable;
