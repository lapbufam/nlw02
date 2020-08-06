import { Request, Response } from "express";

import db from "../database/connection";
import convertHourToMinutes from "../utils/convertHourToMinutes";

interface ScheduleItem {
  weekday: number;
  from: string;
  to: string;
}

export default class ClassesController {
  async index(req: Request, res: Response) {
    const filters = req.query;

    const subject = filters.subject as string;
    const weekday = filters.weekday as string;
    const time = filters.time as string;

    if (!filters.weekday || !filters.subject || !filters.time) {
      return res.status(400).json({ error: "Falta inserir TODOS os filtros." });
    }

    const timeInMinutes = convertHourToMinutes(time);

    const classes = await db("classes")
      .whereExists(function () {
        this.select("class-schedule.*")
          .from("class-schedule")
          .whereRaw("`class-schedule`.`class_id` = `classes`.`id`")
          .whereRaw("`class-schedule`.`weekday` = ??", [Number(weekday)])
          .whereRaw("`class-schedule`.`from` <= ??", [timeInMinutes])
          .whereRaw("`class-schedule`.`to` > ??", [timeInMinutes]);
      })
      .where("classes.subject", "=", subject)
      .join("users", "classes.user_id", "=", "users.id")
      .select("classes.*", "users.*");

    return res.json(classes);
  }

  async create(req: Request, res: Response) {
    const { name, avatar, whatsapp, bio, subject, cost, schedule } = req.body;

    const trx = await db.transaction();

    try {
      const insertedUsersIds = await trx("users").insert({
        name,
        avatar,
        whatsapp,
        bio,
      });

      const user_id = insertedUsersIds[0];

      const insertedClassesIds = await trx("classes").insert({
        subject,
        cost,
        user_id,
      });

      const class_id = insertedClassesIds[0];

      const classSchedule = schedule.map((s: ScheduleItem) => {
        return {
          class_id: class_id,
          weekday: s.weekday,
          from: convertHourToMinutes(s.from),
          to: convertHourToMinutes(s.to),
        };
      });

      await trx("class-schedule").insert(classSchedule);

      await trx.commit();

      return res.status(201).send();
    } catch (error) {
      await trx.rollback();
      res.status(400).json({ message: "Erro ao tentar cadastrar a aula." });
    }
  }
}
