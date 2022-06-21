import type { Task } from "@prisma/client";
import type { ActionFunction, LoaderFunction } from "@remix-run/node";
import { useLoaderData, useFetcher } from "@remix-run/react";
import type { FC } from "react";
import { useRef, useEffect, useState, useCallback } from "react";
import {
  Button,
  Card,
  Col,
  Container,
  Form,
  ListGroup,
  Row,
} from "react-bootstrap";
import { prisma } from "~/db.server";

type LoaderData = Task[];

export const loader: LoaderFunction = (): Promise<LoaderData> =>
  prisma.task.findMany();

const validateId = (fd: FormData) => {
  const id = fd.get("id");
  if (typeof id !== "string") {
    throw new Error("id must be string");
  }

  const intValue = parseInt(id, 10);
  if (isNaN(intValue)) {
    throw new Error("id must be numeric string");
  }

  return intValue;
};

const validateName = (fd: FormData) => {
  const name = fd.get("name");
  if (typeof name !== "string") {
    throw new Error("name must be string");
  }

  if (name.length <= 0) {
    throw new Error("name must be at least 1 characters");
  }

  return name;
};

export const action: ActionFunction = async ({ request }) => {
  const fd = await request.formData();
  const action = fd.get("action");
  switch (action) {
    case "add": {
      await prisma.task.create({
        data: {
          done: false,
          name: validateName(fd),
        },
      });
      return null;
    }

    case "update": {
      await prisma.task.update({
        data: {
          name: validateName(fd),
        },
        where: { id: validateId(fd) },
      });
      return null;
    }

    case "done":
    case "undone": {
      await prisma.task.update({
        where: {
          id: validateId(fd),
        },
        data: {
          done: action === "done",
        },
      });
      return null;
    }
    case "delete": {
      await prisma.task.delete({
        where: {
          id: validateId(fd),
        },
      });
      return null;
    }
    default: {
      throw new Error("unknown action");
    }
  }
};

const TaskItem: FC<{
  task: Task;
  isEditing: boolean;
  onStartEditing: (id: number) => void;
  onFinishEditing: (id: number) => void;
}> = ({ task, isEditing, onStartEditing, onFinishEditing }) => {
  const fetcher = useFetcher();
  const isPending = fetcher.submission !== undefined;

  useEffect(() => {
    if (!isPending) {
      onFinishEditing(task.id);
    }
  }, [isPending, onFinishEditing, task.id]);

  const onClickText = useCallback(() => {
    if (!isPending) {
      onStartEditing(task.id);
    }
  }, [isPending, onStartEditing, task.id]);

  return (
    <ListGroup.Item>
      <Row>
        <Col className="col-auto d-flex align-items-center">
          <Form.Check
            type="checkbox"
            checked={task.done}
            onChange={() => {
              fetcher.submit(
                {
                  id: task.id.toString(),
                  action: task.done ? "undone" : "done",
                },
                { method: "post", replace: true }
              );
            }}
            disabled={isPending}
          />
        </Col>
        <Col
          className="flex-grow-1 d-flex align-items-center text-truncate"
          onClick={onClickText}
        >
          {isEditing ? (
            <fetcher.Form method="post" replace>
              <Row>
                <Col className="flex-grow-1">
                  <Form.Group controlId="name">
                    <Form.Control
                      placeholder="input task name"
                      name="name"
                      defaultValue={task.name}
                      required
                    />
                  </Form.Group>
                </Col>

                <Col className="col-auto">
                  <Button
                    onClick={(e) => {
                      e.stopPropagation();
                      onFinishEditing(task.id);
                    }}
                    variant="outline-primary"
                    disabled={isPending}
                  >
                    Cancel
                  </Button>
                </Col>
                <Col className="col-auto">
                  <input type="hidden" name="id" value={task.id} required />
                  <Button
                    type="submit"
                    name="action"
                    value="update"
                    disabled={isPending}
                  >
                    Update
                  </Button>
                </Col>
              </Row>
            </fetcher.Form>
          ) : (
            task.name
          )}
        </Col>
        <Col className="col-auto">
          <fetcher.Form method="post" replace>
            <input type="hidden" name="id" value={task.id} />
            <Button
              variant="danger"
              type="submit"
              name="action"
              value="delete"
              disabled={isPending}
            >
              Delete
            </Button>
          </fetcher.Form>
        </Col>
      </Row>
    </ListGroup.Item>
  );
};

const AddTaskForm = () => {
  const formRef = useRef<HTMLFormElement>(null);
  const fetcher = useFetcher();
  const isPending = fetcher.submission !== undefined;
  useEffect(() => {
    if (!isPending) {
      formRef.current?.reset();
    }
  }, [isPending]);

  return (
    <fetcher.Form method="post" className="mb-3" ref={formRef} replace>
      <Row>
        <Col className="flex-grow-1">
          <Form.Group controlId="name">
            <Form.Control placeholder="task name" name="name" required />
          </Form.Group>
        </Col>
        <Col className="col-auto">
          <Button type="submit" name="action" value="add" disabled={isPending}>
            Add Task
          </Button>
        </Col>
      </Row>
    </fetcher.Form>
  );
};

export default function Index() {
  const tasks = useLoaderData<LoaderData>();
  const onStartEditing = useCallback((id: number) => setEditingId(id), []);
  const onFinishEditing = useCallback(() => setEditingId(null), []);
  const [editingId, setEditingId] = useState<number | null>(null);

  return (
    <Container className="p-3">
      <AddTaskForm />
      {tasks.length <= 0 ? (
        <Card>
          <Card.Body>No Tasks</Card.Body>
        </Card>
      ) : (
        <ListGroup>
          {tasks.map((task) => (
            <TaskItem
              task={task}
              key={task.id}
              isEditing={editingId === task.id}
              onStartEditing={onStartEditing}
              onFinishEditing={onFinishEditing}
            />
          ))}
        </ListGroup>
      )}
    </Container>
  );
}
