import React, { useState, useEffect } from 'react';
import {
	VictoryChart,
	VictoryBar,
	VictoryAxis,
	VictoryLabel,
	VictoryTheme,
	VictoryGroup,
	VictoryLegend,
} from 'victory';
import { useClubs } from '../../../../../contexts/ClubContext';
import { useManager } from '../../../../../contexts/ManagerContext';
import capitalizer from '../../../../../modules/capitalizer';

const EmployeeGraphs = ({
	isPercentage,
	dataType,
	employeeData,
	employeePercentageData,
	isFirst,
}) => {
	const [managementData, setManagementData] = useState([]);
	const [salesData, setSalesData] = useState([]);
	const [experienceData, setExperienceData] = useState([]);
	const [facilitiesData, setFacilitiesData] = useState([]);
	const [chartWidth, setChartWidth] = useState(600);
	const [clubName, setClubName] = useState('');

	const { clubs } = useClubs();
	const { isDirector } = useManager();

	useEffect(() => {
		const dataLength = Math.max(
			1200,
			(['pool_check_count', 'washroom_check_count'].includes(dataType)
				? experienceData.length
				: managementData.length +
					salesData.length +
					experienceData.length +
					facilitiesData.length) * 50,
		);

		setChartWidth(dataLength);
	}, [dataType, managementData, salesData, experienceData, facilitiesData]);

	useEffect(() => {
		const departmentData = {
			1: [], // Management
			2: [], // Sales
			3: [], // Experience
			4: [], // Facilities
		};

		const data = !isPercentage ? employeeData : employeePercentageData;

		data.forEach((employee) => {
			if (employee[dataType]) {
				const dataObj = { x: employee.name, y: Number(employee[dataType]) };

				if (departmentData[employee.department_id]) {
					departmentData[employee.department_id].push(dataObj);
				}
			}
		});

		setManagementData(departmentData[1]);
		setSalesData(departmentData[2]);
		setExperienceData(departmentData[3]);
		setFacilitiesData(departmentData[4]);
	}, [employeeData, employeePercentageData, isPercentage, dataType]);

	// Graphs that do not need a legend because they are only a single department
	const noLegendGraphs = [
		'pool_check_count',
		'golden_pool_check_count',
		'washroom_check_count',
		'golden_washroom_check_count',
	];

	useEffect(() => {
		if (isDirector && clubs.length > 0 && employeeData.length > 0) {
			const clubIdObj = employeeData.find((obj) => obj.club_id !== undefined);
			if (clubIdObj) {
				const clubId = clubIdObj.club_id;
				const clubObj = clubs.find((obj) => obj.club_id === clubId);
				setClubName(capitalizer(clubObj.database));
			}
		}
	}, [isDirector, clubs, employeeData]);

	return (
		<VictoryChart
			width={chartWidth}
			height={650}
			domainPadding={25}
			padding={{ top: 50, bottom: 200, left: 50, right: 10 }}
			theme={VictoryTheme.clean}
		>
			{isDirector && (
				<VictoryLabel
					text={clubName}
					style={{
						fontSize: 30,
						fill: 'var(--brand)',
						textAnchor: 'middle',
					}}
					dx={chartWidth / 2}
					dy={15}
				/>
			)}
			{!noLegendGraphs.includes(dataType) && isFirst && (
				<VictoryLegend
					x={chartWidth - 500}
					title='Department'
					data={[
						{
							name: 'Management',
							symbol: { fill: 'var(--yellow)' },
						},
						{
							name: 'Sales',
							symbol: { fill: 'var(--blue-light)' },
						},
						{
							name: 'Experience',
							symbol: { fill: 'var(--cyan)' },
						},
						{
							name: 'Facilities',
							symbol: { fill: 'var(--green-light)' },
						},
					]}
					style={{
						title: { fill: 'var(--dark)' },
						labels: { fill: 'var(--dark)', fontSize: 15 },
					}}
				/>
			)}
			<VictoryAxis
				style={{
					axis: { stroke: 'var(--cobalt-light)' },
					tickLabels: {
						fill: 'var(--cobalt-light)',
						fontSize: 20,
						angle: 90,
						textAnchor: 'start',
					},
				}}
				tickLabelComponent={<VictoryLabel textAnchor='middle' dy={-7.5} />}
			/>
			<VictoryAxis
				dependentAxis
				style={{
					axis: { stroke: 'var(--cobalt-light)' },
					tickLabels: { fill: 'var(--cobalt-light)', fontSize: 15 },
				}}
			/>
			{noLegendGraphs.includes(dataType) ? (
				<VictoryBar
					style={{
						data: { fill: 'var(--green)' },
						labels: { fill: 'var(--green)' },
					}}
					data={experienceData}
					barWidth={40}
					labels={({ datum }) => {
						return !isPercentage
							? datum.y.toFixed(0)
							: `${datum.y.toFixed(1)}%`;
					}}
					animate={{
						duration: 500,
						onLoad: { duration: 0, easing: 'quad' },
						easing: 'quad',
					}}
				/>
			) : (
				<VictoryGroup offset={0} style={{ data: { width: 15 } }}>
					<VictoryBar
						style={{
							data: { fill: 'var(--yellow)' },
							labels: { fill: 'var(--yellow)' },
						}}
						data={managementData}
						barWidth={45}
						labels={({ datum }) => {
							return !isPercentage
								? datum.y.toFixed(0)
								: `${datum.y.toFixed(1)}%`;
						}}
						animate={{
							duration: 500,
							onLoad: { duration: 0, easing: 'quad' },
							easing: 'quad',
						}}
					/>
					<VictoryBar
						style={{
							data: { fill: 'var(--blue-light)' },
							labels: { fill: 'var(--blue-light)' },
						}}
						data={salesData}
						barWidth={45}
						labels={({ datum }) => {
							return !isPercentage
								? datum.y.toFixed(0)
								: `${datum.y.toFixed(1)}%`;
						}}
						animate={{
							duration: 500,
							onLoad: { duration: 0, easing: 'quad' },
							easing: 'quad',
						}}
					/>
					<VictoryBar
						style={{
							data: { fill: 'var(--cyan)' },
							labels: { fill: 'var(--cyan)' },
						}}
						data={experienceData}
						barWidth={45}
						labels={({ datum }) => {
							return !isPercentage
								? datum.y.toFixed(0)
								: `${datum.y.toFixed(1)}%`;
						}}
						animate={{
							duration: 500,
							onLoad: { duration: 0, easing: 'quad' },
							easing: 'quad',
						}}
					/>
					<VictoryBar
						style={{
							data: { fill: 'var(--green-light)' },
							labels: { fill: 'var(--green-light)' },
						}}
						data={facilitiesData}
						barWidth={45}
						labels={({ datum }) => {
							return !isPercentage
								? datum.y.toFixed(0)
								: `${datum.y.toFixed(1)}%`;
						}}
						animate={{
							duration: 500,
							onLoad: { duration: 0, easing: 'quad' },
							easing: 'quad',
						}}
					/>
				</VictoryGroup>
			)}
		</VictoryChart>
	);
};

export default EmployeeGraphs;
