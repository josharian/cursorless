package p

type S struct {
	one, b int
}

type (
	A [2]int
	M map[int]int
)

const one = 1

func foo() {
	_ = S{one: 1, b: 2}
	_ = A{1, 2}
	_ = M{1: 2}
	_ = A{0: 1, 2}
	_ = M{}
}

func statements() error {
	fmt.Println("hello")
	if b := false; b {
		return nil
	}
	c := make(chan int, 1)
	c <- 1
	<-c
	var x int
	x = 1
	x++
	{
		type T int
		const two T = 2
		var x T = 1
		x--
		x /= two
	}
	for {
		break
	}
	defer func() {
		recover()
	}()
	go func() {
		fmt.Println("concurrency is not parallelism")
	}()
	var e any = "how long is a piece of me?"
	switch a := a.(type) {
	case int:
		panic("wow")
	default:
		return nil
	}
	switch {
	case x != 2:
		fallthrough
	case x == 1:
		break
	}
Again:
	switch x {
	case 1:
		x &= 1
		goto Again
	case 2:
		return x*2 + x/3
	}
Label:
	for x := 0; x < 10; x++ {
		if x == 0 {
			continue
		}
		if x == 1 {
			break Label
		}
		fmt.Println(x)
	}
	return errors.New("error")
}