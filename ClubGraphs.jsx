import React, { useState, useEffect } from 'react';
import {
	VictoryChart,
	VictoryLine,
	VictoryScatter,
	VictoryTheme,
	VictoryAxis,
	VictoryLabel,
} from 'victory';
import { useData } from '../../../../../contexts/DataContext';
import { useClubs } from '../../../../../contexts/ClubContext';
import { useManager } from '../../../../../contexts/ManagerContext';
import capitalizer from '../../../../../modules/capitalizer';

const ClubGraphs = ({
	isPercentage,
	dataType,
	graphType,
	clubData,
	clubPercentageData,
}) => {
	const [graphData, setGraphData] = useState([]);
	const [bestFitLine, setBestFitLine] = useState([]);
	const [chartWidth, setChartWidth] = useState(600);

	const [slope, setSlope] = useState(0);
	const [totalChange, setTotalChange] = useState([0, 0]);
	const [rateOfChange, setRateOfChange] = useState([0, 0]);
	const [rSquared, setRSquared] = useState(0);

	const [isFirstDatePartial, setIsFirstDatePartial] = useState(false);
	const [isLastDatePartial, setIsLastDatePartial] = useState(false);

	const [clubName, setClubName] = useState('');

	const { rangeEnd } = useData();
	const { clubs } = useClubs();
	const { isDirector } = useManager();

	useEffect(() => {
		const dataLength = Math.max(1200, graphData.length * 50);
		setChartWidth(dataLength);
	}, [dataType, graphData]);

	useEffect(() => {
		if (graphData.length > 1 && graphData[0].y !== 0) {
			const firstValue = graphData[0].y;
			const lastValue = graphData[graphData.length - 1].y;

			const totalChange = lastValue - firstValue;
			const totalPercentageChange = (totalChange / firstValue) * 100;

			const changePerX = totalChange / (graphData.length - 1);
			const percentageChangePerX =
				totalPercentageChange / (graphData.length - 1);

			setTotalChange([totalChange, totalPercentageChange]);
			setRateOfChange([changePerX, percentageChangePerX]);
		}
	}, [graphData]);

	useEffect(() => {
		const data = !isPercentage ? clubData : clubPercentageData;

		if (data[dataType] && data[dataType].length > 1) {
			setGraphData(data[dataType]);
		} else {
			setGraphData([]);
		}
	}, [clubData, dataType, isPercentage, clubPercentageData]);

	useEffect(() => {
		if (graphData.length > 0) {
			// Detect partial weeks at data boundaries for accurate labelling
			const first = new Date(`${graphData[0].x}T00:00:00`);
			const last = new Date(`${graphData[graphData.length - 1].x}T00:00:00`);
			last.setDate(last.getDate() + 6);

			const isLastPartial = rangeEnd ? rangeEnd < last : new Date() < last;

			setIsFirstDatePartial(first.getDay() !== 1);
			setIsLastDatePartial(isLastPartial);
		}
	}, [graphData, rangeEnd]);

	useEffect(() => {
		const dataWithSequentialX = graphData.map((item, index) => ({
			x: index + 1,
			y: item.y,
			date: item.x,
		}));

		/*
			Linear regression using least squares method
			Calculates best-fit line for trend analysis and prediction
			Formula: y = mx + b where m = slope, b = y-intercept
		*/
		const linearRegression = (data) => {
			const n = data.length;
			const sumX = data.reduce((sum, d) => sum + d.x, 0);
			const sumY = data.reduce((sum, d) => sum + d.y, 0);
			const sumXY = data.reduce((sum, d) => sum + d.x * d.y, 0);
			const sumX2 = data.reduce((sum, d) => sum + d.x * d.x, 0);

			const m = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
			setSlope(m);
			const b = (sumY - m * sumX) / n;

			return { m, b };
		};

		const { m, b } = linearRegression(dataWithSequentialX);

		// R-squared calculation for goodness of fit (0 = no correlation, 1 = perfect)
		// Measures what percentage of variance is explained by the linear model

		// Calculate the predicted y-values
		const predictedY = dataWithSequentialX.map((d) => m * d.x + b);

		// Calculate the mean of the actual y-values (needed for variance calculation)
		const yMean =
			dataWithSequentialX.reduce((sum, d) => sum + d.y, 0) /
			dataWithSequentialX.length;

		// Total Sum of Squares: measures total variance in data
		const totalSumOfSquares = dataWithSequentialX.reduce(
			(sum, d) => sum + Math.pow(d.y - yMean, 2),
			0,
		);

		// Residual Sum of Squares: measures unexplained variance
		const residualSumOfSquares = dataWithSequentialX.reduce(
			(sum, d, index) => sum + Math.pow(d.y - predictedY[index], 2),
			0,
		);

		// R² = 1 - (unexplained variance / total variance)
		const rSquared = 1 - residualSumOfSquares / totalSumOfSquares;

		setRSquared(rSquared);

		const xMin = Math.min(...dataWithSequentialX.map((d) => d.x));
		const xMax = Math.max(...dataWithSequentialX.map((d) => d.x));

		setBestFitLine([
			{ x: xMin, y: m * xMin + b },
			{ x: xMax, y: m * xMax + b },
		]);
	}, [graphData]);

	useEffect(() => {
		if (isDirector && clubs.length > 0 && clubData) {
			const clubObj = clubs.find((obj) => obj.club_id === clubData.club_id);
			if (clubObj) {
				setClubName(capitalizer(clubObj.database));
			}
		}
	}, [isDirector, clubs, clubData]);

	return (
		<>
			{graphType === 'line' && (
				<VictoryChart
					width={chartWidth}
					height={650}
					domainPadding={25}
					padding={{ top: 50, bottom: 200, left: 50, right: 10 }}
					theme={VictoryTheme.clean}
				>
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
					{graphData.length < 2 && (
						<VictoryLabel
							text='No Data'
							style={{
								fontSize: 40,
								fill: 'var(--transparent-grey)',
								textAnchor: 'middle',
							}}
							dx={chartWidth / 2}
							dy={200}
						/>
					)}
					{isFirstDatePartial && (
						<VictoryLabel
							text='(Partial)'
							style={{
								fontSize: 20,
								fill: 'var(--cobalt-light)',
								textAnchor: 'middle',
							}}
							dx={70}
							dy={590}
						/>
					)}
					{isLastDatePartial && (
						<VictoryLabel
							text='(Partial)'
							style={{
								fontSize: 20,
								fill: 'var(--cobalt-light)',
								textAnchor: 'middle',
							}}
							dx={chartWidth - 40}
							dy={590}
						/>
					)}
					<VictoryLine
						data={graphData}
						style={{
							data: { stroke: 'var(--green)' },
							labels: { fill: 'var(--cobalt-light)', fontWeight: 'bold' },
						}}
						labels={({ datum }) => {
							return !isPercentage
								? datum.y.toFixed(0)
								: `${datum.y.toFixed(1)}%`;
						}}
						labelComponent={<VictoryLabel dy={-12} />}
						animate={{
							duration: 500,
							onLoad: { duration: 0, easing: 'quad' },
							easing: 'quad',
						}}
					/>
				</VictoryChart>
			)}
			{graphType === 'scatter' && (
				<VictoryChart
					width={chartWidth}
					height={650}
					domainPadding={25}
					padding={{ top: 100, bottom: 200, left: 50, right: 0 }}
					theme={VictoryTheme.clean}
				>
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
					{graphData.length < 2 && (
						<VictoryLabel
							text='No Data'
							style={{
								fontSize: 40,
								fill: 'var(--transparent-grey)',
								textAnchor: 'middle',
							}}
							dx={chartWidth / 2}
							dy={200}
						/>
					)}
					{isFirstDatePartial && (
						<VictoryLabel
							text='(Partial)'
							style={{
								fontSize: 20,
								fill: 'var(--cobalt-light)',
								textAnchor: 'middle',
							}}
							dx={70}
							dy={590}
						/>
					)}
					{isLastDatePartial && (
						<VictoryLabel
							text='(Partial)'
							style={{
								fontSize: 20,
								fill: 'var(--cobalt-light)',
								textAnchor: 'middle',
							}}
							dx={chartWidth - 30}
							dy={590}
						/>
					)}
					<VictoryLabel
						text={`Slope: ${slope.toFixed(2)}`}
						style={{
							fontSize: 17,
							fill: 'var(--cobalt-light)',
							textAnchor: 'end',
						}}
						dx={chartWidth - 30}
						dy={10}
					/>
					<VictoryLabel
						text={`Change: ${totalChange[0].toFixed(1)} (${totalChange[1].toFixed(0)}%)`}
						style={{
							fontSize: 17,
							fill: 'var(--cobalt-light)',
							textAnchor: 'end',
						}}
						dx={chartWidth - 30}
						dy={30}
					/>
					<VictoryLabel
						text={`Rate: ${rateOfChange[0].toFixed(2)} (${rateOfChange[1].toFixed(1)}%)`}
						style={{
							fontSize: 17,
							fill: 'var(--cobalt-light)',
							textAnchor: 'end',
						}}
						dx={chartWidth - 30}
						dy={50}
					/>
					<VictoryLabel
						text={`R\u00B2: ${rSquared.toFixed(2)}`}
						style={{
							fontSize: 17,
							fill: 'var(--cobalt-light)',
							textAnchor: 'end',
						}}
						dx={chartWidth - 30}
						dy={70}
					/>

					<VictoryScatter
						data={graphData}
						style={{
							data: { fill: 'var(--green)' },
							labels: { fill: 'var(--cobalt-light)', fontWeight: 'bold' },
						}}
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
					<VictoryLine
						data={bestFitLine}
						style={{ data: { stroke: 'var(--red)', strokeWidth: 2 } }}
						animate={{
							duration: 500,
							onLoad: { duration: 0, easing: 'quad' },
							easing: 'quad',
						}}
					/>
				</VictoryChart>
			)}
		</>
	);
};

export default ClubGraphs;
