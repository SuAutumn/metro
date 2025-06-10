import { getYAxisValueObj, valueFixedConvert } from "@/utils";
import * as echarts from "echarts";
import moment from "moment";
/**
 * 补负数和整数的中间的0点为了把线连起来
 */
export const addZeros = (
  data: { value: number; dateTime: string; normal: boolean }[]
) => {
  if (!data) return [];
  const result = [];
  for (let i = 0; i < data?.length - 1; i++) {
    result.push(data[i]);
    if (
      (data[i].value > 0 && data[i + 1].value < 0) ||
      (data[i].value < 0 && data[i + 1].value > 0)
    ) {
      const currentDateTime = data[i].dateTime;
      const nextDateTime = data[i + 1].dateTime;
      const midDateTime =
        (moment(currentDateTime).valueOf() + moment(nextDateTime).valueOf()) /
        2;
      result.push({
        value: 0,
        dateTime: moment(midDateTime).format("YYYY-MM-DD HH:mm:ss"),
        normal: data[i].normal,
      });
    }
  }
  result.push(data[data.length - 1]);
  return result;
};

/**
 * 计算y轴数值刻度收益
 */
const yAxisValueFn = (
  data: number[],
  normalList: boolean[],
  soc?: (number | undefined)[],
  socPermission?: boolean
) => {
  const profitNumber = data
    // .filter((item: number) => !isNaN(item))
    .map((item: number) => item);
  // 查找data及额定功率 中的最大绝对值

  if (profitNumber) {
    const yAxisValueObj = getYAxisValueObj({
      originData: profitNumber,
      originUnit: "W",
      changedUnit: "kW",
      carry: 3,
      normalList,
      soc,
      socPermission,
    });

    const maxAbsValue = Math.max(
      ...profitNumber
        .filter((item: number) => !isNaN(item) && item !== undefined)
        .map(Math.abs)
    );

    // 根据最大绝对值选择单位和除数
    const units = [
      { limit: 1000, unit: "W", divisor: 1 },
      { limit: 1000000, unit: "KW", divisor: 1000 },
      { limit: 1000000000, unit: "MW", divisor: 1000000 },
      { limit: Infinity, unit: "GW", divisor: 1000000000 },
    ];

    const { unit, divisor } =
      units.find((u) => maxAbsValue < u.limit) || units[units.length - 1];

    const dataArr = yAxisValueObj?.dataArr.map((item) => {
      return {
        ...item,
        value: item.originValue,
        formattedValue:
          Math.abs(item.originValue) === 0 ||
          Math.abs(item.originValue / 1000) >= 0.01
            ? valueFixedConvert(Number(item.originValue / 1000))
            : valueFixedConvert(Number(item.originValue / 1000), 3),
        unit,
      };
    });
    console.log(divisor, "divisor");

    return {
      unit,
      dataArr,
    };
  }
};

export const getChartOption = (
  data: number[],
  xAxis: any[],
  yAxisUnit?: string,
  normalList?: boolean[],
  soc?: (number | undefined)[],
  socPermission?: boolean
): echarts.EChartsOption => {
  //查找data中的最大值
  const yAxisValue = yAxisValueFn(
    data,
    normalList ?? [],
    socPermission ? soc : [],
    socPermission
  );
  const convertDataArr =
    yAxisValue?.dataArr?.map((item, i) => ({
      ...item,
      time: moment(xAxis[i]).format("HH:mm"),
    })) || [];

  const legendData = [
    {
      name: "储能充放电功率",
      textStyle: {
        color: "#969799",
      },
    },
  ];
  if (socPermission) {
    legendData.push({
      name: "SOC",
      textStyle: {
        color: "#969799",
      },
    });
  }

  return {
    grid: {
      left: 2,
      right: 2,
      bottom: 30,
      top: 30,
      containLabel: true,
    },
    legend: {
      itemStyle: {
        opacity: 0,
      },
      itemWidth: 14,
      selectedMode: false,
      bottom: 0,
      itemGap: 62,
      padding: 0,
      data: legendData,
    },
    xAxis: {
      type: "time",
      axisLabel: {
        show: true,
        formatter: (value: any, index: number) => {
          // 每隔三个数据点显示一个标签
          return index % 2 === 0 ? "{HH}:{mm}" : "";
        },
        color: "rgba(200, 201, 204, 1)",
        fontSize: 10,
        margin: 12,
      },
      axisLine: {
        show: true,
        lineStyle: {
          color: "rgba(25, 28, 38, 0.06)",
        },
      },
      splitLine: {
        show: false,
        lineStyle: {
          color: "rgba(25, 28, 38, 0.10)",
          type: "dashed",
        },
      },
      axisTick: { show: false },
    },
    yAxis: [
      {
        name: yAxisUnit,
        position: "left",
        nameTextStyle: {
          fontSize: 10,
          color: "#BBC1CA",
          fontWeight: 500,
          padding: [0, 22, 0, 0],
        },
        type: "value",
        splitLine: {
          lineStyle: {
            type: "dashed",
            color: "#DEDEE2",
            width: 0.5,
          },
        },
        axisLabel: {
          color: "rgba(200, 201, 204, 1)",
          fontSize: 10,
          formatter: (value: any) => {
            const figures = (globalParams.divisor > 1 && 1) || 0;
            return (value / globalParams.divisor).toFixed(figures);
          },
        },
      },
      {
        show: socPermission,
        name: "%",
        position: "right",
        nameTextStyle: {
          color: "#BBC1CA",
          fontWeight: 500,
          fontSize: 10,
          padding: [0, 0, -5, 0],
        },
        type: "value",
        splitLine: {
          show: false,
        },
        max: 100,
        min: 0,
        axisLabel: {
          fontSize: 10,
          color: "rgba(200, 201, 204, 1)",
          fontFamily: "PingFangSC, PingFang SC",
          fontStyle: "italic",
          fontWeight: 500,
        },
      },
    ],
    tooltip: {
      show: true,
      trigger: "axis",
      borderColor: "transparent",
      padding: 0,
      confine: true,
      formatter: (params: any) => {
        if (!Array.isArray(params)) return "loading";
        const param = params?.find((item) => item.value[1] !== "notShow");

        if (!param) return "";

        if (Number(param.data[2].time.split(":")[1]) % 5 !== 0) {
          return "";
        }
        let label = "";
        if (param.data[2].originValue > 0) {
          label = "放电功率";
        } else if (param.data[2].originValue < 0) {
          label = "充电功率";
        } else {
          label = "功率";
        }

        const value = param?.data[2]?.formattedValue;
        const normal = param?.data[2]?.normal;
        const socValue = param?.data[2]?.soc;
        const permission = param?.data[2]?.socPermission;

        // const unit = param?.data[2]?.unit;

        return `<div style='position: relative;width: fit-content;height: fit-content;background-color: #fff;border-radius: 10px;padding-bottom: 5px;padding-top:5px;max-width: 200px;overflow:hidden;'>
    <span style='color: #666666; font-size: 12px;padding: 5px 10px 0px 10px;'>${
      param.data[2].time
    }</span>
    <br/>
    <span style='color: #666666; font-size: 12px;padding-left: 10px;'>${label}:</span>
            <span style='font-weight: bold;color:#212121'>${value}</span>
            <span style='font-size: 10px;padding-right: 10px;'>kw</span>
            <br/>
            ${
              normal
                ? `<div style='color: rgba(0,0,0,0.6); font-size: 8px;white-space: pre-wrap;padding-left: 10px;line-height:12px;margin-bottom: 10px'>【为避免过充或亏电出现小功率充放电属于正常现象，此为智能调节的正常机制，您无需特别留意</div>`
                : `<div></div>`
            }
            ${
              permission
                ? `<div><span style='color: #666666; font-size: 12px;padding-left: 10px;margin-top: 20px'>SOC:</span>
            <span style='font-weight: bold;color:#212121'>${socValue}</span>
            <span style='font-size: 10px;padding-right: 10px;'>%</span></div>`
                : ""
            }

      </div>`;
      },
    },
    series: [
      {
        yAxisIndex: 0,
        data: convertDataArr
          .map((item) => {
            return item.value;
          })
          .map((d, i) => [new Date(xAxis[i]).valueOf(), d, convertDataArr[i]]),
        type: "line",
        symbol: "none",
        name: "储能充放电功率",
        lineStyle: {
          width: 1,
          color: "rgba(59, 101, 238, 0.1)",
        },
        areaStyle: {
          opacity: 0.1,
          color: "rgba(59, 101, 238, 1)",
        },
        emphasis: {
          lineStyle: {
            width: 1,
          },
        },
      },
      {
        yAxisIndex: 1,
        data: socPermission
          ? soc?.map((d, i) => [new Date(xAxis[i]).valueOf(), d])
          : [],
        type: "line",
        smooth: true,
        symbol: "none",
        name: "SOC",
        lineStyle: {
          width: 1,
          color: "#3FBC19",
        },
      },
    ],
  };
};

//生成option
export const getOption = (
  chargingStateChartData: {
    chartData: any[];
    xAxis: string[];
    normalList: boolean[];
    soc: { dateTime: string; value: number }[];
    socPermission: boolean;
  },
  yAxisUnit?: string
) => {
  const computedData = chargingStateChartData?.chartData?.map((item, index) => {
    return {
      value: item,
      dateTime: chargingStateChartData?.xAxis[index],
      normal: chargingStateChartData?.normalList[index],
    };
  });
  const chartData = computedData?.map((item) => item.value) || [];
  const xAxis = computedData?.map((item) => moment(item.dateTime)) || [];
  const normalList = computedData?.map((item) => item.normal);

  const socData = xAxis?.map((item: any) => {
    const target = chargingStateChartData?.soc?.find((soc) =>
      moment(soc.dateTime).isSame(item)
    );
    if (target) {
      return target?.value;
    } else {
      return undefined;
    }
  });

  return getChartOption(
    chartData,
    xAxis,
    yAxisUnit,
    normalList,
    socData,
    chargingStateChartData?.socPermission
  );
};
