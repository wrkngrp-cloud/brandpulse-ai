-- Africa/Nigeria OOH costs are quoted monthly, not weekly
alter table ooh_sites rename column weekly_cost to monthly_cost;
